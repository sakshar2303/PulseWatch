package writer

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

// Writer defines the interface for persisting metric batches.
type Writer interface {
	WriteBatch(ctx context.Context, points []model.MetricPoint) (int, error)
	Ping(ctx context.Context) error
	Close()
}

// TimescaleWriter writes batches of MetricPoints to TimescaleDB via pgxpool.
type TimescaleWriter struct {
	pool *pgxpool.Pool
}

// NewTimescaleWriter creates a new TimescaleWriter backed by a connection pool.
func NewTimescaleWriter(ctx context.Context, dbURL string, maxConns, minConns int32) (*TimescaleWriter, error) {
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	cfg.MaxConns = maxConns
	cfg.MinConns = minConns

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize pgx connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping TimescaleDB: %w", err)
	}

	return &TimescaleWriter{pool: pool}, nil
}

// WriteBatch writes a slice of MetricPoints using pgx.Batch.
// Each query executes INSERT ... ON CONFLICT (time, metric_name, host) DO NOTHING,
// ensuring idempotency when collectors retry after network drops.
func (w *TimescaleWriter) WriteBatch(ctx context.Context, points []model.MetricPoint) (int, error) {
	if len(points) == 0 {
		return 0, nil
	}

	batch := &pgx.Batch{}
	query := `
		INSERT INTO metrics (time, metric_name, value, host, service, tags)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (time, metric_name, host) DO NOTHING;
	`

	for _, pt := range points {
		tagsJSON, err := json.Marshal(pt.Tags)
		if err != nil {
			tagsJSON = []byte("{}")
		}

		batch.Queue(query, pt.Timestamp, pt.MetricName, pt.Value, pt.Host, pt.Service, tagsJSON)
	}

	br := w.pool.SendBatch(ctx, batch)
	defer br.Close()

	rowsInserted := 0
	for i := 0; i < len(points); i++ {
		tag, err := br.Exec()
		if err != nil {
			return rowsInserted, fmt.Errorf("failed executing batch item %d (%s): %w", i, points[i].MetricName, err)
		}
		rowsInserted += int(tag.RowsAffected())
	}

	return rowsInserted, nil
}

// Ping checks database reachability.
func (w *TimescaleWriter) Ping(ctx context.Context) error {
	return w.pool.Ping(ctx)
}

// Close shuts down the connection pool.
func (w *TimescaleWriter) Close() {
	if w.pool != nil {
		w.pool.Close()
	}
}
