package handler

import (
	"encoding/json"
	"math"
	"net/http"

	"github.com/sakshar2303/pulsewatch/api/internal/middleware"
)

// SLOHandler exposes Service Level Objective compliance metrics.
type SLOHandler struct {
	collector *middleware.SLICollector
}

// NewSLOHandler creates a handler that reads from the shared SLI collector.
func NewSLOHandler(c *middleware.SLICollector) *SLOHandler {
	return &SLOHandler{collector: c}
}

// SLOTarget defines an individual SLO.
type SLOTarget struct {
	Name        string  `json:"name"`
	Target      float64 `json:"target"`
	Current     float64 `json:"current"`
	Compliance  bool    `json:"in_compliance"`
	BudgetUsed  float64 `json:"budget_used_percent"`
}

// SLOResponse is the full SLO compliance report.
type SLOResponse struct {
	SLIs       middleware.SLISnapshot `json:"slis"`
	Objectives []SLOTarget           `json:"objectives"`
}

// HandleSLO handles GET /api/v1/slo — returns current SLO compliance.
func (h *SLOHandler) HandleSLO(w http.ResponseWriter, r *http.Request) {
	snap := h.collector.Snapshot()

	// Define SLO targets
	availabilitySLO := SLOTarget{
		Name:    "Availability (success rate)",
		Target:  99.9,
		Current: snap.SuccessRate,
	}
	availabilitySLO.Compliance = snap.SuccessRate >= availabilitySLO.Target

	// Error budget: how much of the allowed error rate has been consumed
	// Target 99.9% → allowed error = 0.1%. If current error is 0.05%, budget used = 50%.
	allowedErrorRate := 100.0 - availabilitySLO.Target
	actualErrorRate := 100.0 - snap.SuccessRate
	if allowedErrorRate > 0 {
		availabilitySLO.BudgetUsed = math.Round((actualErrorRate/allowedErrorRate)*10000) / 100
	}
	if availabilitySLO.BudgetUsed < 0 {
		availabilitySLO.BudgetUsed = 0
	}

	latencySLO := SLOTarget{
		Name:    "Latency (p99 < 500ms)",
		Target:  500.0,
		Current: snap.LatencyP99Ms,
	}
	latencySLO.Compliance = snap.LatencyP99Ms <= latencySLO.Target
	// Budget: how much of 500ms ceiling is consumed
	if latencySLO.Target > 0 {
		latencySLO.BudgetUsed = math.Round((snap.LatencyP99Ms/latencySLO.Target)*10000) / 100
	}

	resp := SLOResponse{
		SLIs: snap,
		Objectives: []SLOTarget{
			availabilitySLO,
			latencySLO,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}
