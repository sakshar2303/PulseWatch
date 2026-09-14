package model

import (
	"math"
	"testing"
	"time"
)

func validMetricPoint() MetricPoint {
	return MetricPoint{
		MetricName:  "cpu_usage_percent",
		Value:       45.2,
		Timestamp:   time.Now().UTC(),
		Host:        "web-server-01",
		Service:     "api-gateway",
		Tags:        map[string]string{"env": "production"},
		CollectorID: "collector-01",
		SequenceNum: 1,
	}
}

func TestMetricPoint_Validate_Success(t *testing.T) {
	m := validMetricPoint()
	if err := m.Validate(); err != nil {
		t.Fatalf("expected valid metric point, got: %v", err)
	}
}

func TestMetricPoint_Validate_EmptyMetricName(t *testing.T) {
	m := validMetricPoint()
	m.MetricName = "   "
	if err := m.Validate(); err == nil || err != ErrEmptyMetricName {
		t.Fatalf("expected ErrEmptyMetricName, got: %v", err)
	}
}

func TestMetricPoint_Validate_InvalidCharacters(t *testing.T) {
	m := validMetricPoint()
	m.MetricName = "cpu usage; DROP TABLE metrics;"
	if err := m.Validate(); err == nil {
		t.Fatalf("expected error for SQL injection attempt in metric_name, got nil")
	}
}

func TestMetricPoint_Validate_NaNValue(t *testing.T) {
	m := validMetricPoint()
	m.Value = math.NaN()
	if err := m.Validate(); err == nil || err != ErrInvalidValue {
		t.Fatalf("expected ErrInvalidValue for NaN, got: %v", err)
	}
}

func TestMetricPoint_Validate_InfValue(t *testing.T) {
	m := validMetricPoint()
	m.Value = math.Inf(1)
	if err := m.Validate(); err == nil || err != ErrInvalidValue {
		t.Fatalf("expected ErrInvalidValue for +Inf, got: %v", err)
	}
}

func TestMetricPoint_Validate_EmptyHost(t *testing.T) {
	m := validMetricPoint()
	m.Host = ""
	if err := m.Validate(); err == nil || err != ErrEmptyHost {
		t.Fatalf("expected ErrEmptyHost, got: %v", err)
	}
}

func TestMetricPoint_Validate_EmptyService(t *testing.T) {
	m := validMetricPoint()
	m.Service = ""
	if err := m.Validate(); err == nil || err != ErrEmptyService {
		t.Fatalf("expected ErrEmptyService, got: %v", err)
	}
}

func TestMetricPoint_Validate_EmptyCollectorID(t *testing.T) {
	m := validMetricPoint()
	m.CollectorID = ""
	if err := m.Validate(); err == nil || err != ErrEmptyCollectorID {
		t.Fatalf("expected ErrEmptyCollectorID, got: %v", err)
	}
}

func TestMetricPoint_Validate_ZeroTimestamp(t *testing.T) {
	m := validMetricPoint()
	m.Timestamp = time.Time{}
	if err := m.Validate(); err == nil || err != ErrZeroTimestamp {
		t.Fatalf("expected ErrZeroTimestamp, got: %v", err)
	}
}

func TestMetricPoint_Validate_FutureTimestamp(t *testing.T) {
	m := validMetricPoint()
	m.Timestamp = time.Now().UTC().Add(15 * time.Minute)
	if err := m.Validate(); err == nil || err != ErrFutureTimestamp {
		t.Fatalf("expected ErrFutureTimestamp, got: %v", err)
	}
}

func TestMetricPoint_Validate_StaleTimestamp(t *testing.T) {
	m := validMetricPoint()
	m.Timestamp = time.Now().UTC().Add(-8 * 24 * time.Hour)
	if err := m.Validate(); err == nil || err != ErrStaleTimestamp {
		t.Fatalf("expected ErrStaleTimestamp, got: %v", err)
	}
}
