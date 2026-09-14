package handler

import (
	"encoding/json"
	"net/http"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// ServicesHandler handles GET /api/v1/services.
type ServicesHandler struct {
	store store.Store
}

// NewServicesHandler creates a new ServicesHandler.
func NewServicesHandler(s store.Store) *ServicesHandler {
	return &ServicesHandler{store: s}
}

// HandleServices processes GET /api/v1/services.
func (h *ServicesHandler) HandleServices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	services, err := h.store.GetServices(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch services: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"services": services,
	})
}
