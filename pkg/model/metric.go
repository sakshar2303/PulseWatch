package model

import (
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

var (
	// ErrEmptyMetricName is returned when metric name is missing.
	ErrEmptyMetricName = errors.New("metric_name cannot be empty")
	// ErrInvalidMetricName is returned when metric name contains invalid characters.
	ErrInvalidMetricName = errors.New("metric_name must contain only alphanumeric characters, underscores, dots, or hyphens")
	// ErrInvalidValue is returned when value is NaN or infinite.
	ErrInvalidValue = errors.New("metric value cannot be NaN or infinite")
	// ErrEmptyHost is returned when host is missing.
	ErrEmptyHost = errors.New("host cannot be empty")
	// ErrEmptyService is returned when service is missing.
	ErrEmptyService = errors.New("service cannot be empty")
	// ErrEmptyCollectorID is returned when collector_id is missing.
	ErrEmptyCollectorID = errors.New("collector_id cannot be empty")
	// ErrZeroTimestamp is returned when timestamp is not provided.
	ErrZeroTimestamp = errors.New("timestamp cannot be zero")
	// ErrFutureTimestamp is returned when timestamp is too far in the future (clock skew guard).
	ErrFutureTimestamp = errors.New("timestamp cannot be more than 10 minutes in the future")
	// ErrStaleTimestamp is returned when timestamp is older than retention window.
	ErrStaleTimestamp = errors.New("timestamp cannot be older than 7 days")

	metricNameRegex = regexp.MustCompile(`^[a-zA-Z0-9_\.\-]+$`)
)

// MetricPoint represents a single metric sample captured by a collector agent.
// It is the standard wire format across collector, ingestion, storage, and API.
type MetricPoint struct {
	MetricName  string            `json:"metric_name"`
	Value       float64           `json:"value"`
	Timestamp   time.Time         `json:"timestamp"`
	Host        string            `json:"host"`
	Service     string            `json:"service"`
	Tags        map[string]string `json:"tags,omitempty"`
	CollectorID string            `json:"collector_id"`
	SequenceNum uint64            `json:"sequence_num"`
}

// Validate checks the MetricPoint for semantic correctness and boundary conditions.
// Returns nil if valid, or a descriptive error explaining the validation failure.
func (m *MetricPoint) Validate() error {
	m.MetricName = strings.TrimSpace(m.MetricName)
	if m.MetricName == "" {
		return ErrEmptyMetricName
	}
	if !metricNameRegex.MatchString(m.MetricName) {
		return fmt.Errorf("%w: %q", ErrInvalidMetricName, m.MetricName)
	}

	if math.IsNaN(m.Value) || math.IsInf(m.Value, 0) {
		return ErrInvalidValue
	}

	m.Host = strings.TrimSpace(m.Host)
	if m.Host == "" {
		return ErrEmptyHost
	}

	m.Service = strings.TrimSpace(m.Service)
	if m.Service == "" {
		return ErrEmptyService
	}

	m.CollectorID = strings.TrimSpace(m.CollectorID)
	if m.CollectorID == "" {
		return ErrEmptyCollectorID
	}

	if m.Timestamp.IsZero() {
		return ErrZeroTimestamp
	}

	now := time.Now().UTC()
	// Guard against clock skew: reject timestamps > 10 minutes in the future
	if m.Timestamp.After(now.Add(10 * time.Minute)) {
		return ErrFutureTimestamp
	}

	// Guard against stale data older than 7 days (hypertable chunk window)
	if m.Timestamp.Before(now.Add(-7 * 24 * time.Hour)) {
		return ErrStaleTimestamp
	}

	return nil
}
