package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/pkg/model"
)

func samplePoints() []model.MetricPoint {
	return []model.MetricPoint{
		{
			MetricName:  "cpu_usage_percent",
			Value:       55.4,
			Timestamp:   time.Now().UTC(),
			Host:        "host-1",
			Service:     "api",
			CollectorID: "col-1",
			SequenceNum: 1,
		},
	}
}

func TestHTTPClient_SendMetrics_Success(t *testing.T) {
	var receivedCount atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		var pts []model.MetricPoint
		if err := json.NewDecoder(r.Body).Decode(&pts); err != nil {
			t.Errorf("failed to decode body: %v", err)
		}
		receivedCount.Add(int32(len(pts)))

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	c := NewHTTPClient(server.URL, 2*time.Second, 10*time.Millisecond, 2)
	ctx := context.Background()

	err := c.SendMetrics(ctx, samplePoints())
	if err != nil {
		t.Fatalf("expected send to succeed, got: %v", err)
	}

	if receivedCount.Load() != 1 {
		t.Fatalf("expected server to receive 1 point, got %d", receivedCount.Load())
	}
}

func TestHTTPClient_SendMetrics_RetryOn500(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := attempts.Add(1)
		if count < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	c := NewHTTPClient(server.URL, 2*time.Second, 10*time.Millisecond, 3)
	ctx := context.Background()

	err := c.SendMetrics(ctx, samplePoints())
	if err != nil {
		t.Fatalf("expected send to eventually succeed after retries, got: %v", err)
	}

	if attempts.Load() != 3 {
		t.Fatalf("expected exactly 3 attempts, got %d", attempts.Load())
	}
}

func TestHTTPClient_SendMetrics_NoRetryOn400(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts.Add(1)
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	c := NewHTTPClient(server.URL, 2*time.Second, 10*time.Millisecond, 3)
	ctx := context.Background()

	err := c.SendMetrics(ctx, samplePoints())
	if err == nil {
		t.Fatalf("expected error on 400 Bad Request, got nil")
	}

	// Should NOT retry on 400
	if attempts.Load() != 1 {
		t.Fatalf("expected exactly 1 attempt on 400 error, got %d", attempts.Load())
	}
}
