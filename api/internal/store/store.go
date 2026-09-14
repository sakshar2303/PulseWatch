package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Datapoint represents a single timestamp-value pair in a metric series.
type Datapoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
}

// SeriesResult groups datapoints by host and service for charting.
type SeriesResult struct {
	Host       string      `json:"host"`
	Service    string      `json:"service"`
	Datapoints []Datapoint `json:"datapoints"`
}

// QueryResult represents the top-level API response for a metric query.
type QueryResult struct {
	MetricName string         `json:"metric_name"`
	Series     []SeriesResult `json:"series"`
}

// Store defines database operations required by the Query API.
type Store interface {
	GetMetricNames(ctx context.Context) ([]string, error)
	QueryRaw(ctx context.Context, name string, start, end time.Time, service, host string) (*QueryResult, error)
	QueryBucket(ctx context.Context, name string, start, end time.Time, step, agg, service, host string) (*QueryResult, error)
	Ping(ctx context.Context) error
	Close()
}

// PgxStore implements Store using TimescaleDB via pgxpool.
type PgxStore struct {
	pool *pgxpool.Pool
}

// NewPgxStore creates and validates a new TimescaleDB connection pool.
func NewPgxStore(ctx context.Context, dbURL string, maxConns, minConns int32) (*PgxStore, error) {
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	cfg.MaxConns = maxConns
	cfg.MinConns = minConns

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &PgxStore{pool: pool}, nil
}

// GetMetricNames returns all distinct metric names recorded in the database.
func (s *PgxStore) GetMetricNames(ctx context.Context) ([]string, error) {
	query := `SELECT DISTINCT metric_name FROM metrics ORDER BY metric_name ASC;`
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query metric names: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan metric name: %w", err)
		}
		names = append(names, name)
	}

	if names == nil {
		names = []string{}
	}
	return names, nil
}

// QueryRaw retrieves unaggregated datapoints within [start, end].
func (s *PgxStore) QueryRaw(ctx context.Context, name string, start, end time.Time, service, host string) (*QueryResult, error) {
	var queryBuilder strings.Builder
	queryBuilder.WriteString(`
		SELECT time, host, service, value
		FROM metrics
		WHERE metric_name = $1 AND time >= $2 AND time <= $3
	`)

	args := []any{name, start, end}
	argIdx := 4

	if service != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND service = $%d", argIdx))
		args = append(args, service)
		argIdx++
	}

	if host != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND host = $%d", argIdx))
		args = append(args, host)
		argIdx++
	}

	queryBuilder.WriteString(" ORDER BY host, service, time ASC LIMIT 5000;")

	rows, err := s.pool.Query(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute raw metric query: %w", err)
	}
	defer rows.Close()

	seriesMap := make(map[string]*SeriesResult)
	var seriesOrder []string

	for rows.Next() {
		var ts time.Time
		var h, svc string
		var val float64

		if err := rows.Scan(&ts, &h, &svc, &val); err != nil {
			return nil, fmt.Errorf("failed to scan raw metric row: %w", err)
		}

		key := h + "|" + svc
		sr, exists := seriesMap[key]
		if !exists {
			sr = &SeriesResult{
				Host:       h,
				Service:    svc,
				Datapoints: make([]Datapoint, 0, 100),
			}
			seriesMap[key] = sr
			seriesOrder = append(seriesOrder, key)
		}

		sr.Datapoints = append(sr.Datapoints, Datapoint{
			Time:  ts.UTC(),
			Value: val,
		})
	}

	result := &QueryResult{
		MetricName: name,
		Series:     make([]SeriesResult, 0, len(seriesOrder)),
	}

	for _, k := range seriesOrder {
		result.Series = append(result.Series, *seriesMap[k])
	}

	return result, nil
}

// QueryBucket retrieves downsampled metrics using TimescaleDB's time_bucket.
func (s *PgxStore) QueryBucket(ctx context.Context, name string, start, end time.Time, step, agg, service, host string) (*QueryResult, error) {
	// Whitelist allowed aggregation functions to prevent SQL injection
	aggLower := strings.ToLower(agg)
	switch aggLower {
	case "avg", "max", "min", "sum", "count":
	default:
		aggLower = "avg"
	}

	var queryBuilder strings.Builder
	queryBuilder.WriteString(fmt.Sprintf(`
		SELECT time_bucket($1::interval, time) AS bucket, host, service, %s(value) AS agg_val
		FROM metrics
		WHERE metric_name = $2 AND time >= $3 AND time <= $4
	`, aggLower))

	args := []any{step, name, start, end}
	argIdx := 5

	if service != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND service = $%d", argIdx))
		args = append(args, service)
		argIdx++
	}

	if host != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND host = $%d", argIdx))
		args = append(args, host)
		argIdx++
	}

	queryBuilder.WriteString(" GROUP BY bucket, host, service ORDER BY host, service, bucket ASC LIMIT 5000;")

	rows, err := s.pool.Query(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute time_bucket query: %w", err)
	}
	defer rows.Close()

	seriesMap := make(map[string]*SeriesResult)
	var seriesOrder []string

	for rows.Next() {
		var ts time.Time
		var h, svc string
		var val float64

		if err := rows.Scan(&ts, &h, &svc, &val); err != nil {
			return nil, fmt.Errorf("failed to scan time_bucket row: %w", err)
		}

		key := h + "|" + svc
		sr, exists := seriesMap[key]
		if !exists {
			sr = &SeriesResult{
				Host:       h,
				Service:    svc,
				Datapoints: make([]Datapoint, 0, 100),
			}
			seriesMap[key] = sr
			seriesOrder = append(seriesOrder, key)
		}

		sr.Datapoints = append(sr.Datapoints, Datapoint{
			Time:  ts.UTC(),
			Value: val,
		})
	}

	result := &QueryResult{
		MetricName: name,
		Series:     make([]SeriesResult, 0, len(seriesOrder)),
	}

	for _, k := range seriesOrder {
		result.Series = append(result.Series, *seriesMap[k])
	}

	return result, nil
}

// Ping verifies database connectivity.
func (s *PgxStore) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

// Close closes the connection pool.
func (s *PgxStore) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}
