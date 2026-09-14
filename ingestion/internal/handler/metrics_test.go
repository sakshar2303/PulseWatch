package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/ingestion/internal/batcher"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

type dummyWriter struct{}

func (d *dummyWriter) WriteBatch(ctx context.Context, points []model.MetricPoint) (int, error) {
	return len(points), nil
}

func setupTestHandler(maxBytes int64) (*MetricsHandler, *batcher.Batcher) {
	b := batcher.New(&dummyWriter{}, 10, time.Second, 100)
	return NewMetricsHandler(b, maxBytes), b
}

func TestMetricsHandler_HandleIngest_ValidSingle(t *testing.T) {
	h, b := setupTestHandler(1024 * 1024)
	defer b.Stop()

	point := model.MetricPoint{
		MetricName:  "cpu_usage_percent",
		Value:       75.0,
		Timestamp:   time.Now().UTC(),
		Host:        "host-1",
		Service:     "api",
		CollectorID: "col-1",
		SequenceNum: 1,
	}

	body, _ := json.Marshal(point)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/metrics", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.HandleIngest(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMetricsHandler_HandleIngest_ValidArray(t *testing.T) {
	h, b := setupTestHandler(1024 * 1024)
	defer b.Stop()

	points := []model.MetricPoint{
		{
			MetricName:  "cpu_usage_percent",
			Value:       75.0,
			Timestamp:   time.Now().UTC(),
			Host:        "host-1",
			Service:     "api",
			CollectorID: "col-1",
			SequenceNum: 1,
		},
		{
			MetricName:  "memory_usage_percent",
			Value:       60.0,
			Timestamp:   time.Now().UTC(),
			Host:        "host-1",
			Service:     "api",
			CollectorID: "col-1",
			SequenceNum: 2,
		},
	}

	body, _ := json.Marshal(points)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/metrics", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.HandleIngest(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp IngestResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Accepted != 2 {
		t.Fatalf("expected 2 accepted points, got %d", resp.Accepted)
	}
}

func TestMetricsHandler_HandleIngest_PayloadTooLarge(t *testing.T) {
	// Restrict to tiny 50 byte max body
	h, b := setupTestHandler(50)
	defer b.Stop()

	point := model.MetricPoint{
		MetricName:  "cpu_usage_percent_with_a_very_long_name_that_exceeds_fifty_bytes",
		Value:       75.0,
		Timestamp:   time.Now().UTC(),
		Host:        "host-1",
		Service:     "api",
		CollectorID: "col-1",
		SequenceNum: 1,
	}

	body, _ := json.Marshal(point)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/metrics", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.HandleIngest(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 Payload Too Large, got %d", rec.Code)
	}
}

func TestMetricsHandler_HandleIngest_InvalidPointValidation(t *testing.T) {
	h, b := setupTestHandler(1024 * 1024)
	defer b.Stop()

	// Missing host
	point := model.MetricPoint{
		MetricName:  "cpu_usage_percent",
		Value:       75.0,
		Timestamp:   time.Now().UTC(),
		Host:        "",
		Service:     "api",
		CollectorID: "col-1",
		SequenceNum: 1,
	}

	body, _ := json.Marshal(point)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/metrics", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.HandleIngest(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
	}
}
