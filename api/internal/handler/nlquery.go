package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// NLQueryHandler handles AI-powered natural language metric queries.
type NLQueryHandler struct {
	anthropicAPIKey string
	metricNames     []string // injected at init for schema context
}

// NewNLQueryHandler creates a new NLQueryHandler.
func NewNLQueryHandler(anthropicAPIKey string) *NLQueryHandler {
	return &NLQueryHandler{anthropicAPIKey: anthropicAPIKey}
}

// SetMetricNames updates the known metric names for schema context.
func (h *NLQueryHandler) SetMetricNames(names []string) {
	h.metricNames = names
}

// NLQueryRequest is the JSON body for a natural language query request.
type NLQueryRequest struct {
	Prompt      string   `json:"prompt"`
	MetricNames []string `json:"metric_names,omitempty"` // optional override
}

// NLQueryResponse is the structured result returned to the frontend.
type NLQueryResponse struct {
	// Structured params the frontend should use to call /api/v1/metrics/query
	MetricName  string `json:"metric_name"`
	Aggregation string `json:"aggregation"`  // avg | max | min
	TimeRange   string `json:"time_range"`   // e.g. "1h", "24h", "7d"
	Host        string `json:"host"`         // empty = all hosts
	Service     string `json:"service"`      // empty = all services
	// Explanation of what Claude understood
	Explanation string `json:"explanation"`
}

// anthropicRequest matches the Anthropic Messages API payload.
type anthropicRequest struct {
	Model     string              `json:"model"`
	MaxTokens int                 `json:"max_tokens"`
	Messages  []anthropicMessage  `json:"messages"`
	System    string              `json:"system"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}

// HandleNLQuery processes POST /api/v1/ai/nl-query.
func (h *NLQueryHandler) HandleNLQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}

	if h.anthropicAPIKey == "" {
		writeError(w, http.StatusServiceUnavailable, "AI_NOT_CONFIGURED", "ANTHROPIC_API_KEY is not set on the server")
		return
	}

	var req NLQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid JSON body: "+err.Error())
		return
	}
	if strings.TrimSpace(req.Prompt) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "prompt must not be empty")
		return
	}

	// Use caller-provided metric names or fall back to injected list
	metricNames := req.MetricNames
	if len(metricNames) == 0 {
		metricNames = h.metricNames
	}

	result, err := h.callClaude(r.Context(), req.Prompt, metricNames)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "AI_ERROR", "failed to process NL query: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(result)
}

// callClaude sends the prompt to Claude and parses the structured JSON response.
func (h *NLQueryHandler) callClaude(ctx context.Context, userPrompt string, metricNames []string) (*NLQueryResponse, error) {
	metricsStr := strings.Join(metricNames, ", ")

	systemPrompt := fmt.Sprintf(`You are a time-series metrics query translator for PulseWatch, an observability platform.

The database has a "metrics" table with these columns: metric_name, host, service, value, time.

Known metric names: %s

Your job is to translate the user's natural language question into a structured JSON query object.
You MUST respond with ONLY a valid JSON object — no prose, no markdown, no code fences.

The JSON must have exactly these fields:
- "metric_name": string — the exact metric name from the known list (pick the closest match)
- "aggregation": string — one of: "avg", "max", "min"
- "time_range": string — one of: "5m", "15m", "1h", "6h", "24h", "7d"
- "host": string — specific host name if mentioned, otherwise ""
- "service": string — specific service name if mentioned, otherwise ""
- "explanation": string — one sentence describing what query you're running and why

Examples:
User: "show me peak CPU over the last hour"
{"metric_name":"cpu_usage_percent","aggregation":"max","time_range":"1h","host":"","service":"","explanation":"Showing maximum CPU usage percent over the last hour across all hosts."}

User: "average memory on api-server in the last 15 minutes"
{"metric_name":"memory_usage_bytes","aggregation":"avg","time_range":"15m","host":"","service":"api-server","explanation":"Showing average memory usage for the api-server service over the last 15 minutes."}

Current UTC time: %s`, metricsStr, time.Now().UTC().Format(time.RFC3339))

	payload := anthropicRequest{
		Model:     "claude-3-5-sonnet-20240620",
		MaxTokens: 256,
		System:    systemPrompt,
		Messages: []anthropicMessage{
			{Role: "user", Content: userPrompt},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal Claude request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", h.anthropicAPIKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("Claude API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Claude API returned %d: %s", resp.StatusCode, string(errBody))
	}

	var anthropicResp anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&anthropicResp); err != nil {
		return nil, fmt.Errorf("failed to decode Claude response: %w", err)
	}

	if len(anthropicResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from Claude")
	}

	rawJSON := strings.TrimSpace(anthropicResp.Content[0].Text)

	var result NLQueryResponse
	if err := json.Unmarshal([]byte(rawJSON), &result); err != nil {
		return nil, fmt.Errorf("Claude returned non-JSON response: %s", rawJSON)
	}

	// Sanitize / apply defaults
	if result.Aggregation == "" {
		result.Aggregation = "avg"
	}
	if result.TimeRange == "" {
		result.TimeRange = "1h"
	}

	return &result, nil
}
