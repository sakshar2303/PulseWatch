package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/sakshar2303/pulsewatch/ingestion/internal/batcher"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

// MetricsHandler processes metric ingest requests.
type MetricsHandler struct {
	batcher      *batcher.Batcher
	maxBodyBytes int64
}

// NewMetricsHandler creates a new handler instance.
func NewMetricsHandler(b *batcher.Batcher, maxBodyBytes int64) *MetricsHandler {
	return &MetricsHandler{
		batcher:      b,
		maxBodyBytes: maxBodyBytes,
	}
}

type IngestResponse struct {
	Status   string `json:"status"`
	Accepted int    `json:"accepted"`
	Dropped  int    `json:"dropped,omitempty"`
}

// HandleIngest handles HTTP POST /api/v1/metrics.
// Accepts either a single MetricPoint JSON object or an array of MetricPoints.
func (h *MetricsHandler) HandleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed","code":"METHOD_NOT_ALLOWED"}`, http.StatusMethodNotAllowed)
		return
	}

	// Guard against memory exhaustion via unbounded payload sizes
	r.Body = http.MaxBytesReader(w, r.Body, h.maxBodyBytes)
	defer r.Body.Close()

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "request payload exceeds maximum allowed size",
				"code":  "PAYLOAD_TOO_LARGE",
			})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "failed to read request body",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	if len(bodyBytes) == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "empty request body",
			"code":  "EMPTY_PAYLOAD",
		})
		return
	}

	var points []model.MetricPoint

	// Check if JSON is an array or single object
	if bodyBytes[0] == '[' {
		if err := json.Unmarshal(bodyBytes, &points); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "failed to parse metric array: " + err.Error(),
				"code":  "MALFORMED_JSON",
			})
			return
		}
	} else {
		var single model.MetricPoint
		if err := json.Unmarshal(bodyBytes, &single); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "failed to parse metric object: " + err.Error(),
				"code":  "MALFORMED_JSON",
			})
			return
		}
		points = []model.MetricPoint{single}
	}

	// Validate each point
	accepted := 0
	dropped := 0
	for _, pt := range points {
		if err := pt.Validate(); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "invalid metric point (" + pt.MetricName + "): " + err.Error(),
				"code":  "VALIDATION_FAILED",
			})
			return
		}

		if h.batcher.Enqueue(pt) {
			accepted++
		} else {
			dropped++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if dropped > 0 {
		// Queue was saturated for some points — 429 Too Many Requests communicates backpressure
		w.WriteHeader(http.StatusTooManyRequests)
	} else {
		w.WriteHeader(http.StatusAccepted)
	}

	_ = json.NewEncoder(w).Encode(IngestResponse{
		Status:   "ok",
		Accepted: accepted,
		Dropped:  dropped,
	})
}
