package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// QueryHandler handles metric query endpoints.
type QueryHandler struct {
	store store.Store
}

// NewQueryHandler creates a new QueryHandler.
func NewQueryHandler(s store.Store) *QueryHandler {
	return &QueryHandler{store: s}
}

// HandleQuery processes GET /api/v1/metrics/query.
func (h *QueryHandler) HandleQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	q := r.URL.Query()
	name := q.Get("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "missing required query parameter: 'name'")
		return
	}

	now := time.Now().UTC()

	// Parse start time (default: 1 hour ago)
	startStr := q.Get("start")
	startTime := now.Add(-1 * time.Hour)
	if startStr != "" {
		t, err := time.Parse(time.RFC3339, startStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid 'start' timestamp (RFC3339 expected): "+err.Error())
			return
		}
		startTime = t
	}

	// Parse end time (default: now)
	endStr := q.Get("end")
	endTime := now
	if endStr != "" {
		t, err := time.Parse(time.RFC3339, endStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid 'end' timestamp (RFC3339 expected): "+err.Error())
			return
		}
		endTime = t
	}

	if startTime.After(endTime) {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "'start' timestamp must be before 'end' timestamp")
		return
	}

	service := q.Get("service")
	host := q.Get("host")
	step := q.Get("step")
	agg := q.Get("agg")
	if agg == "" {
		agg = "avg"
	}

	var result *store.QueryResult
	var err error

	if step != "" {
		// Aggregated query via TimescaleDB time_bucket
		result, err = h.store.QueryBucket(r.Context(), name, startTime, endTime, step, agg, service, host)
	} else {
		// Raw points query
		result, err = h.store.QueryRaw(r.Context(), name, startTime, endTime, service, host)
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to query metrics: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(result)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"code":  code,
		"error": message,
	})
}
