package metrics

import (
	"context"
	"testing"
	"time"
)

func TestSystemCollector_Collect(t *testing.T) {
	c := NewSystemCollector("test-host", "test-service", "test-collector")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	points, err := c.Collect(ctx)
	if err != nil {
		t.Fatalf("expected successful collection, got err: %v", err)
	}

	if len(points) == 0 {
		t.Fatalf("expected at least 1 metric point, got 0")
	}

	// Verify points have expected metadata and pass validation
	foundCPU := false
	foundMemory := false
	for _, pt := range points {
		if pt.Host != "test-host" {
			t.Errorf("expected host 'test-host', got %q", pt.Host)
		}
		if pt.Service != "test-service" {
			t.Errorf("expected service 'test-service', got %q", pt.Service)
		}
		if pt.CollectorID != "test-collector" {
			t.Errorf("expected collectorID 'test-collector', got %q", pt.CollectorID)
		}
		if pt.SequenceNum == 0 {
			t.Errorf("expected non-zero sequence number for %s", pt.MetricName)
		}
		if err := pt.Validate(); err != nil {
			t.Errorf("collected point %s failed validation: %v", pt.MetricName, err)
		}

		if pt.MetricName == "cpu_usage_percent" {
			foundCPU = true
			if pt.Value < 0 || pt.Value > 100 {
				t.Errorf("cpu_usage_percent out of bounds: %f", pt.Value)
			}
		}
		if pt.MetricName == "memory_usage_percent" {
			foundMemory = true
			if pt.Value < 0 || pt.Value > 100 {
				t.Errorf("memory_usage_percent out of bounds: %f", pt.Value)
			}
		}
	}

	if !foundCPU {
		t.Log("[WARN] cpu_usage_percent not reported in test environment")
	}
	if !foundMemory {
		t.Log("[WARN] memory_usage_percent not reported in test environment")
	}
}
