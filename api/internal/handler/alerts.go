package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// AlertsHandler manages CRUD HTTP requests for alert rules.
type AlertsHandler struct {
	store store.Store
}

// NewAlertsHandler creates a new AlertsHandler.
func NewAlertsHandler(s store.Store) *AlertsHandler {
	return &AlertsHandler{store: s}
}

// HandleList processes GET /api/v1/alerts/rules (optional query ?enabled=true).
func (h *AlertsHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	enabledOnly := false
	if enStr := r.URL.Query().Get("enabled"); enStr != "" {
		if b, err := strconv.ParseBool(enStr); err == nil {
			enabledOnly = b
		}
	}

	rules, err := h.store.GetAlertRules(r.Context(), enabledOnly)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to fetch alert rules: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"rules": rules,
		"count": len(rules),
	})
}

// HandleGet processes GET /api/v1/alerts/rules/{id}.
func (h *AlertsHandler) HandleGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid rule id")
		return
	}

	rule, err := h.store.GetAlertRule(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(rule)
}

// CreateRuleRequest is the payload for creating an alert rule.
type CreateRuleRequest struct {
	Name       string   `json:"name"`
	MetricName string   `json:"metric_name"`
	Condition  string   `json:"condition"`
	Threshold  float64  `json:"threshold"`
	Duration   string   `json:"duration"`
	Severity   string   `json:"severity"`
	Service    *string  `json:"service"`
	Host       *string  `json:"host"`
	Enabled    *bool    `json:"enabled"`
}

// HandleCreate processes POST /api/v1/alerts/rules.
func (h *AlertsHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	var req CreateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "malformed request payload: "+err.Error())
		return
	}

	// Validation
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
		return
	}
	if strings.TrimSpace(req.MetricName) == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "metric_name is required")
		return
	}
	validConditions := map[string]bool{">": true, "<": true, ">=": true, "<=": true, "==": true}
	if !validConditions[req.Condition] {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "condition must be one of >, <, >=, <=, ==")
		return
	}
	validSeverities := map[string]bool{"info": true, "warning": true, "critical": true}
	if !validSeverities[req.Severity] {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "severity must be info, warning, or critical")
		return
	}
	if strings.TrimSpace(req.Duration) == "" {
		req.Duration = "5 minutes"
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	rule := &store.AlertRule{
		Name:       req.Name,
		MetricName: req.MetricName,
		Condition:  req.Condition,
		Threshold:  req.Threshold,
		Duration:   req.Duration,
		Severity:   req.Severity,
		Service:    req.Service,
		Host:       req.Host,
		Enabled:    enabled,
	}

	created, err := h.store.CreateAlertRule(r.Context(), rule)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create alert rule: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(created)
}

// HandleUpdate processes PUT /api/v1/alerts/rules/{id}.
func (h *AlertsHandler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid rule id")
		return
	}

	var req CreateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "malformed request payload: "+err.Error())
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
		return
	}
	if strings.TrimSpace(req.MetricName) == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "metric_name is required")
		return
	}
	validConditions := map[string]bool{">": true, "<": true, ">=": true, "<=": true, "==": true}
	if !validConditions[req.Condition] {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "condition must be one of >, <, >=, <=, ==")
		return
	}
	validSeverities := map[string]bool{"info": true, "warning": true, "critical": true}
	if !validSeverities[req.Severity] {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "severity must be info, warning, or critical")
		return
	}
	if strings.TrimSpace(req.Duration) == "" {
		req.Duration = "5 minutes"
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	rule := &store.AlertRule{
		Name:       req.Name,
		MetricName: req.MetricName,
		Condition:  req.Condition,
		Threshold:  req.Threshold,
		Duration:   req.Duration,
		Severity:   req.Severity,
		Service:    req.Service,
		Host:       req.Host,
		Enabled:    enabled,
	}

	updated, err := h.store.UpdateAlertRule(r.Context(), id, rule)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(updated)
}

// HandleDelete processes DELETE /api/v1/alerts/rules/{id}.
func (h *AlertsHandler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid rule id")
		return
	}

	if err := h.store.DeleteAlertRule(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"id":      id,
		"status":  "deleted",
		"message": "alert rule deleted successfully",
	})
}

// HandleToggle processes PATCH /api/v1/alerts/rules/{id}/toggle.
func (h *AlertsHandler) HandleToggle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch && r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid rule id")
		return
	}

	toggled, err := h.store.ToggleAlertRule(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(toggled)
}
