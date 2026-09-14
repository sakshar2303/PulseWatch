package handler

import (
	"encoding/json"
	"net/http"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// NamesHandler returns distinct metric names.
type NamesHandler struct {
	store store.Store
}

// NewNamesHandler creates a new NamesHandler.
func NewNamesHandler(s store.Store) *NamesHandler {
	return &NamesHandler{store: s}
}

// HandleNames processes GET /api/v1/metrics/names.
func (h *NamesHandler) HandleNames(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	names, err := h.store.GetMetricNames(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch metric names: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string][]string{
		"names": names,
	})
}
