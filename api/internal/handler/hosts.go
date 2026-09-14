package handler

import (
	"encoding/json"
	"net/http"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// HostsHandler handles GET /api/v1/hosts.
type HostsHandler struct {
	store store.Store
}

// NewHostsHandler creates a new HostsHandler.
func NewHostsHandler(s store.Store) *HostsHandler {
	return &HostsHandler{store: s}
}

// HandleHosts processes GET /api/v1/hosts.
func (h *HostsHandler) HandleHosts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	hosts, err := h.store.GetHosts(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch hosts: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"hosts": hosts,
	})
}
