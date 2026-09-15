package handler

import (
	"encoding/json"
	"net/http"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// ForecastHandler handles forecast-related API requests.
type ForecastHandler struct {
	store store.Store
}

// NewForecastHandler creates a new ForecastHandler.
func NewForecastHandler(s store.Store) *ForecastHandler {
	return &ForecastHandler{store: s}
}

// HandleForecasts processes GET /api/v1/forecasts.
func (h *ForecastHandler) HandleForecasts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	q := r.URL.Query()
	metric := q.Get("metric")
	host := q.Get("host")
	service := q.Get("service")

	if metric == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "missing 'metric' parameter")
		return
	}
	if host == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "missing 'host' parameter")
		return
	}
	if service == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "missing 'service' parameter")
		return
	}

	forecasts, err := h.store.GetForecasts(r.Context(), metric, host, service)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to query forecasts: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"forecasts": forecasts,
	})
}
