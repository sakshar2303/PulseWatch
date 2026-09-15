package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/api/internal/middleware"
)

func TestSLOHandler_HandleSLO(t *testing.T) {
	collector := middleware.NewSLICollector(time.Hour)

	// Record 9 successes and 1 500 error
	for i := 0; i < 9; i++ {
		collector.Record(middleware.RequestRecord{
			Path:       "/api/v1/metrics",
			Method:     http.MethodGet,
			StatusCode: http.StatusOK,
			Latency:    25 * time.Millisecond,
			Timestamp:  time.Now(),
		})
	}
	collector.Record(middleware.RequestRecord{
		Path:       "/api/v1/metrics",
		Method:     http.MethodGet,
		StatusCode: http.StatusInternalServerError,
		Latency:    120 * time.Millisecond,
		Timestamp:  time.Now(),
	})

	sloHandler := NewSLOHandler(collector)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/slo", nil)
	rr := httptest.NewRecorder()

	sloHandler.HandleSLO(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var resp SLOResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.SLIs.TotalRequests != 10 {
		t.Errorf("expected 10 total requests, got %d", resp.SLIs.TotalRequests)
	}

	if resp.SLIs.SuccessRate != 90.0 {
		t.Errorf("expected 90.0%% success rate, got %f", resp.SLIs.SuccessRate)
	}

	if len(resp.Objectives) != 2 {
		t.Fatalf("expected 2 objectives, got %d", len(resp.Objectives))
	}

	// Availability objective
	avail := resp.Objectives[0]
	if avail.Compliance {
		t.Errorf("expected availability compliance to be false (90%% < 99.9%%)")
	}

	// Latency objective
	lat := resp.Objectives[1]
	if !lat.Compliance {
		t.Errorf("expected latency compliance to be true (p99 < 500ms)")
	}
}
