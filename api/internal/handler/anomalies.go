package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// AnomaliesHandler handles /api/v1/anomalies endpoints.
type AnomaliesHandler struct {
	store store.Store
}

// NewAnomaliesHandler creates a new AnomaliesHandler.
func NewAnomaliesHandler(s store.Store) *AnomaliesHandler {
	return &AnomaliesHandler{store: s}
}

// HandleList processes GET /api/v1/anomalies.
func (h *AnomaliesHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	q := r.URL.Query()
	service := q.Get("service")
	severity := q.Get("severity")

	var resolved *bool
	if resStr := q.Get("resolved"); resStr != "" {
		b, err := strconv.ParseBool(resStr)
		if err == nil {
			resolved = &b
		}
	}

	limit := 50
	if limStr := q.Get("limit"); limStr != "" {
		if l, err := strconv.Atoi(limStr); err == nil && l > 0 {
			limit = l
		}
	}

	offset := 0
	if offStr := q.Get("offset"); offStr != "" {
		if o, err := strconv.Atoi(offStr); err == nil && o >= 0 {
			offset = o
		}
	}

	anomalies, total, err := h.store.GetAnomalies(r.Context(), service, severity, resolved, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch anomalies: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"anomalies": anomalies,
		"total":     total,
		"limit":     limit,
		"offset":    offset,
	})
}

// HandleResolve processes PATCH /api/v1/anomalies/{id}/resolve.
func (h *AnomaliesHandler) HandleResolve(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch && r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	idStr := r.PathValue("id")
	if idStr == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "missing anomaly id in path")
		return
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid anomaly id")
		return
	}

	if err := h.store.ResolveAnomaly(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":      id,
		"status":  "resolved",
		"message": "anomaly resolved successfully",
	})
}
