package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// HealthHandler checks service and database liveness.
type HealthHandler struct {
	store store.Store
}

// NewHealthHandler creates a new HealthHandler.
func NewHealthHandler(s store.Store) *HealthHandler {
	return &HealthHandler{store: s}
}

// HandleHealth handles GET /health.
func (h *HealthHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	dbStatus := "healthy"
	status := "healthy"
	httpStatus := http.StatusOK

	if err := h.store.Ping(ctx); err != nil {
		dbStatus = "unhealthy: " + err.Error()
		status = "degraded"
		httpStatus = http.StatusServiceUnavailable
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status":  status,
		"service": "pulsewatch-api",
		"dependencies": map[string]string{
			"timescaledb": dbStatus,
		},
	})
}
