package middleware

import (
	"math"
	"net/http"
	"sort"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// SLI Metrics Collector
// ---------------------------------------------------------------------------
// Thread-safe in-memory collector that records per-request latency and status
// code information. Used by the SLO endpoint to compute real-time compliance.
// ---------------------------------------------------------------------------

// RequestRecord holds one observed HTTP request's outcome.
type RequestRecord struct {
	Path       string
	Method     string
	StatusCode int
	Latency    time.Duration
	Timestamp  time.Time
}

// SLICollector accumulates request-level metrics in a rolling window.
type SLICollector struct {
	mu      sync.RWMutex
	records []RequestRecord
	window  time.Duration // sliding window size (e.g. 5 minutes)
}

// NewSLICollector creates a new collector with the given rolling window.
func NewSLICollector(window time.Duration) *SLICollector {
	return &SLICollector{
		records: make([]RequestRecord, 0, 1024),
		window:  window,
	}
}

// Record adds a request observation.
func (c *SLICollector) Record(r RequestRecord) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.records = append(c.records, r)
}

// pruneOld removes records outside the rolling window. Must hold write lock.
func (c *SLICollector) pruneOld() {
	cutoff := time.Now().Add(-c.window)
	i := 0
	for i < len(c.records) && c.records[i].Timestamp.Before(cutoff) {
		i++
	}
	if i > 0 {
		c.records = c.records[i:]
	}
}

// SLISnapshot is a point-in-time view of SLI metrics.
type SLISnapshot struct {
	WindowSeconds  float64            `json:"window_seconds"`
	TotalRequests  int                `json:"total_requests"`
	ErrorCount     int                `json:"error_count"`
	SuccessRate    float64            `json:"success_rate"`
	LatencyP50Ms   float64            `json:"latency_p50_ms"`
	LatencyP95Ms   float64            `json:"latency_p95_ms"`
	LatencyP99Ms   float64            `json:"latency_p99_ms"`
	LatencyMaxMs   float64            `json:"latency_max_ms"`
	ByEndpoint     map[string]*EndpointSLI `json:"by_endpoint"`
}

// EndpointSLI holds per-endpoint breakdown.
type EndpointSLI struct {
	Requests    int     `json:"requests"`
	Errors      int     `json:"errors"`
	SuccessRate float64 `json:"success_rate"`
	P50Ms       float64 `json:"p50_ms"`
	P99Ms       float64 `json:"p99_ms"`
}

// Snapshot returns the current SLI metrics within the rolling window.
func (c *SLICollector) Snapshot() SLISnapshot {
	c.mu.Lock()
	c.pruneOld()
	// Copy slice under lock to release quickly
	snapshot := make([]RequestRecord, len(c.records))
	copy(snapshot, c.records)
	c.mu.Unlock()

	total := len(snapshot)
	if total == 0 {
		return SLISnapshot{
			WindowSeconds: c.window.Seconds(),
			ByEndpoint:    make(map[string]*EndpointSLI),
		}
	}

	errors := 0
	latencies := make([]float64, 0, total)
	byEndpoint := make(map[string]*EndpointSLI)

	for _, r := range snapshot {
		ms := float64(r.Latency.Microseconds()) / 1000.0
		latencies = append(latencies, ms)

		if r.StatusCode >= 500 {
			errors++
		}

		key := r.Method + " " + r.Path
		ep, ok := byEndpoint[key]
		if !ok {
			ep = &EndpointSLI{}
			byEndpoint[key] = ep
		}
		ep.Requests++
		if r.StatusCode >= 500 {
			ep.Errors++
		}
	}

	sort.Float64s(latencies)

	// Per-endpoint latency calculation
	for key := range byEndpoint {
		ep := byEndpoint[key]
		if ep.Requests > 0 {
			ep.SuccessRate = math.Round((1.0-float64(ep.Errors)/float64(ep.Requests))*10000) / 100
		}
	}

	// Compute per-endpoint percentiles
	epLatencies := make(map[string][]float64)
	for _, r := range snapshot {
		key := r.Method + " " + r.Path
		ms := float64(r.Latency.Microseconds()) / 1000.0
		epLatencies[key] = append(epLatencies[key], ms)
	}
	for key, lats := range epLatencies {
		sort.Float64s(lats)
		ep := byEndpoint[key]
		ep.P50Ms = math.Round(percentile(lats, 0.50)*100) / 100
		ep.P99Ms = math.Round(percentile(lats, 0.99)*100) / 100
	}

	return SLISnapshot{
		WindowSeconds: c.window.Seconds(),
		TotalRequests: total,
		ErrorCount:    errors,
		SuccessRate:   math.Round((1.0-float64(errors)/float64(total))*10000) / 100,
		LatencyP50Ms:  math.Round(percentile(latencies, 0.50)*100) / 100,
		LatencyP95Ms:  math.Round(percentile(latencies, 0.95)*100) / 100,
		LatencyP99Ms:  math.Round(percentile(latencies, 0.99)*100) / 100,
		LatencyMaxMs:  math.Round(latencies[len(latencies)-1]*100) / 100,
		ByEndpoint:    byEndpoint,
	}
}

// percentile returns the p-th percentile from sorted data (0 ≤ p ≤ 1).
func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := p * float64(len(sorted)-1)
	lower := int(idx)
	upper := lower + 1
	if upper >= len(sorted) {
		return sorted[len(sorted)-1]
	}
	frac := idx - float64(lower)
	return sorted[lower]*(1-frac) + sorted[upper]*frac
}

// SLI returns HTTP middleware that records request latency and status to the
// given SLICollector. Chain it after tracing but before CORS.
func SLI(collector *SLICollector) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, statusCode: http.StatusOK}

			next.ServeHTTP(sw, r)

			collector.Record(RequestRecord{
				Path:       r.URL.Path,
				Method:     r.Method,
				StatusCode: sw.statusCode,
				Latency:    time.Since(start),
				Timestamp:  start,
			})
		})
	}
}
