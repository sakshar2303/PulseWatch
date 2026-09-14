package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/sakshar2303/pulsewatch/ingestion/internal/batcher"
	"github.com/sakshar2303/pulsewatch/ingestion/internal/writer"
)

// HealthHandler serves liveness and readiness checks.
type HealthHandler struct {
	writer  writer.Writer
	batcher *batcher.Batcher
}

// NewHealthHandler creates a new health handler.
func NewHealthHandler(w writer.Writer, b *batcher.Batcher) *HealthHandler {
	return &HealthHandler{writer: w, batcher: b}
}

type HealthResponse struct {
	Status       string            `json:"status"`
	Service      string            `json:"service"`
	Dependencies map[string]string `json:"dependencies"`
	Stats        BatcherStats      `json:"stats"`
}

type BatcherStats struct {
	Enqueued uint64 `json:"enqueued"`
	Flushed  uint64 `json:"flushed"`
	Dropped  uint64 `json:"dropped"`
}

// HandleHealth handles GET /health.
func (h *HealthHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	dbStatus := "healthy"
	if err := h.writer.Ping(ctx); err != nil {
		dbStatus = "unhealthy: " + err.Error()
	}

	enqueued, flushed, dropped := h.batcher.Stats()

	status := "healthy"
	httpStatus := http.StatusOK
	if dbStatus != "healthy" {
		status = "degraded"
		httpStatus = http.StatusServiceUnavailable
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	_ = json.NewEncoder(w).Encode(HealthResponse{
		Status:  status,
		Service: "pulsewatch-ingestion",
		Dependencies: map[string]string{
			"timescaledb": dbStatus,
		},
		Stats: BatcherStats{
			Enqueued: enqueued,
			Flushed:  flushed,
			Dropped:  dropped,
		},
	})
}
