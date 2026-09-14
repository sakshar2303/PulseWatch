package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

type mockStore struct {
	names       []string
	rawResult   *store.QueryResult
	bucketResult *store.QueryResult
	err         error
}

func (m *mockStore) GetMetricNames(ctx context.Context) ([]string, error) {
	return m.names, m.err
}

func (m *mockStore) QueryRaw(ctx context.Context, name string, start, end time.Time, service, host string) (*store.QueryResult, error) {
	return m.rawResult, m.err
}

func (m *mockStore) QueryBucket(ctx context.Context, name string, start, end time.Time, step, agg, service, host string) (*store.QueryResult, error) {
	return m.bucketResult, m.err
}

func (m *mockStore) Ping(ctx context.Context) error {
	return m.err
}

func (m *mockStore) Close() {}

func TestQueryHandler_MissingName(t *testing.T) {
	h := NewQueryHandler(&mockStore{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/query", nil)
	rec := httptest.NewRecorder()

	h.HandleQuery(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
	}
}

func TestQueryHandler_StartAfterEnd(t *testing.T) {
	h := NewQueryHandler(&mockStore{})
	now := time.Now().UTC()
	start := now.Format(time.RFC3339)
	end := now.Add(-1 * time.Hour).Format(time.RFC3339)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/query?name=cpu&start="+start+"&end="+end, nil)
	rec := httptest.NewRecorder()

	h.HandleQuery(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for start > end, got %d", rec.Code)
	}
}

func TestQueryHandler_InvalidTimestampFormat(t *testing.T) {
	h := NewQueryHandler(&mockStore{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/query?name=cpu&start=not-a-timestamp", nil)
	rec := httptest.NewRecorder()

	h.HandleQuery(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for malformed timestamp, got %d", rec.Code)
	}
}

func TestQueryHandler_RawQuerySuccess(t *testing.T) {
	now := time.Now().UTC()
	mockRes := &store.QueryResult{
		MetricName: "cpu_usage_percent",
		Series: []store.SeriesResult{
			{
				Host:    "web-01",
				Service: "gateway",
				Datapoints: []store.Datapoint{
					{Time: now, Value: 62.4},
				},
			},
		},
	}

	h := NewQueryHandler(&mockStore{rawResult: mockRes})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/query?name=cpu_usage_percent", nil)
	rec := httptest.NewRecorder()

	h.HandleQuery(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var res store.QueryResult
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(res.Series) != 1 || res.Series[0].Datapoints[0].Value != 62.4 {
		t.Fatalf("unexpected query result data: %+v", res)
	}
}

func TestQueryHandler_BucketQuerySuccess(t *testing.T) {
	now := time.Now().UTC()
	mockRes := &store.QueryResult{
		MetricName: "cpu_usage_percent",
		Series: []store.SeriesResult{
			{
				Host:    "web-01",
				Service: "gateway",
				Datapoints: []store.Datapoint{
					{Time: now, Value: 50.0},
				},
			},
		},
	}

	h := NewQueryHandler(&mockStore{bucketResult: mockRes})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/query?name=cpu_usage_percent&step=1m&agg=avg", nil)
	rec := httptest.NewRecorder()

	h.HandleQuery(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestQueryHandler_StoreError(t *testing.T) {
	h := NewQueryHandler(&mockStore{err: errors.New("db connection lost")})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/metrics/query?name=cpu_usage_percent", nil)
	rec := httptest.NewRecorder()

	h.HandleQuery(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 Internal Server Error, got %d", rec.Code)
	}
}
