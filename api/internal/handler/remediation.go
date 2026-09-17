package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

// RemediationHandler handles auto-remediation API requests.
type RemediationHandler struct {
	store store.Store
}

// NewRemediationHandler creates a new RemediationHandler.
func NewRemediationHandler(s store.Store) *RemediationHandler {
	return &RemediationHandler{store: s}
}

// HandleList lists remediations.
func (h *RemediationHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	status := r.URL.Query().Get("status")
	service := r.URL.Query().Get("service")

	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 500 {
			limit = l
		}
	}

	remediations, err := h.store.GetRemediations(r.Context(), limit, status, service)
	if err != nil {
		log.Printf("[ERROR] Failed to list remediations: %v", err)
		http.Error(w, "Failed to list remediations", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(remediations)
}

// HandleGet returns a single remediation.
func (h *RemediationHandler) HandleGet(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid remediation ID", http.StatusBadRequest)
		return
	}

	remediation, err := h.store.GetRemediation(r.Context(), id)
	if err != nil {
		log.Printf("[ERROR] Failed to get remediation %d: %v", id, err)
		http.Error(w, "Remediation not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(remediation)
}

// HandleStats returns summary statistics for the dashboard.
func (h *RemediationHandler) HandleStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.store.GetRemediationStats(r.Context())
	if err != nil {
		log.Printf("[ERROR] Failed to get remediation stats: %v", err)
		http.Error(w, "Failed to get stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// TriggerRequest defines the manual override payload.
type TriggerRequest struct {
	Service      string  `json:"service"`
	Host         string  `json:"host"`
	MetricName   string  `json:"metric_name"`
	CurrentValue float64 `json:"current_value"`
	Description  string  `json:"description"`
	Severity     string  `json:"severity"`
	AnomalyID    *int64  `json:"anomaly_id"`
	RCASummary   *string `json:"rca_summary"`
	TriggerType  string  `json:"trigger_type"` // default: manual
}

// HandleTrigger calls the Python detector service to trigger remediation.
func (h *RemediationHandler) HandleTrigger(w http.ResponseWriter, r *http.Request) {
	var req TriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.Service == "" || req.Host == "" || req.MetricName == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	req.TriggerType = "manual"

	payloadBytes, err := json.Marshal(req)
	if err != nil {
		http.Error(w, "Failed to encode request", http.StatusInternalServerError)
		return
	}

	// Forward the request to the Python Detector API
	detectorURL := "http://localhost:8000/api/v1/remediate/trigger"
	
	proxyReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, detectorURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		http.Error(w, "Failed to create proxy request", http.StatusInternalServerError)
		return
	}
	proxyReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(proxyReq)
	if err != nil {
		log.Printf("[ERROR] Failed to contact detector service for remediation: %v", err)
		http.Error(w, "Failed to trigger remediation", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[ERROR] Detector service returned error %d: %s", resp.StatusCode, string(bodyBytes))
		http.Error(w, "Detector service failed to process trigger", http.StatusBadGateway)
		return
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		http.Error(w, "Failed to parse response from detector", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
