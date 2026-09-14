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

type anomalyMockStore struct {
	mockStore
	anomalies  []store.Anomaly
	services   []store.ServiceInfo
	hosts      []store.HostInfo
	total      int
	resolveErr error
}

func (m *anomalyMockStore) GetAnomalies(ctx context.Context, service, severity string, resolved *bool, limit, offset int) ([]store.Anomaly, int, error) {
	if m.err != nil {
		return nil, 0, m.err
	}
	return m.anomalies, m.total, nil
}

func (m *anomalyMockStore) ResolveAnomaly(ctx context.Context, id int64) error {
	return m.resolveErr
}

func (m *anomalyMockStore) GetServices(ctx context.Context) ([]store.ServiceInfo, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.services, nil
}

func (m *anomalyMockStore) GetHosts(ctx context.Context) ([]store.HostInfo, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.hosts, nil
}

func TestAnomaliesHandler_List_Success(t *testing.T) {
	mock := &anomalyMockStore{
		anomalies: []store.Anomaly{
			{
				ID:          1,
				DetectedAt:  time.Now().UTC(),
				MetricName:  "cpu_usage_percent",
				Host:        "host-1",
				Service:     "api-gateway",
				Severity:    "critical",
				Type:        "threshold",
				Description: "CPU exceeded 90%",
				Value:       95.5,
			},
		},
		total: 1,
	}

	h := NewAnomaliesHandler(mock)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/anomalies?severity=critical&limit=10", nil)
	rec := httptest.NewRecorder()

	h.HandleList(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if total, ok := resp["total"].(float64); !ok || int(total) != 1 {
		t.Fatalf("expected total 1, got %v", resp["total"])
	}
}

func TestAnomaliesHandler_Resolve_Success(t *testing.T) {
	mock := &anomalyMockStore{}
	h := NewAnomaliesHandler(mock)

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/anomalies/42/resolve", nil)
	req.SetPathValue("id", "42")
	rec := httptest.NewRecorder()

	h.HandleResolve(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAnomaliesHandler_Resolve_NotFound(t *testing.T) {
	mock := &anomalyMockStore{resolveErr: errors.New("not found")}
	h := NewAnomaliesHandler(mock)

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/anomalies/999/resolve", nil)
	req.SetPathValue("id", "999")
	rec := httptest.NewRecorder()

	h.HandleResolve(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got %d", rec.Code)
	}
}

func TestServicesHandler_Success(t *testing.T) {
	mock := &anomalyMockStore{
		services: []store.ServiceInfo{
			{Name: "api-gateway", HostCount: 2, Status: "healthy", LastSeen: time.Now().UTC()},
		},
	}
	h := NewServicesHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/services", nil)
	rec := httptest.NewRecorder()

	h.HandleServices(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
}

func TestHostsHandler_Success(t *testing.T) {
	mock := &anomalyMockStore{
		hosts: []store.HostInfo{
			{Name: "host-1", Service: "api-gateway", Status: "healthy", LastSeen: time.Now().UTC()},
		},
	}
	h := NewHostsHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/hosts", nil)
	rec := httptest.NewRecorder()

	h.HandleHosts(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
}
