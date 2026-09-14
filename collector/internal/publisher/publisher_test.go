package publisher

import (
	"context"
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/pkg/model"
)

func samplePoint(name string, val float64) model.MetricPoint {
	return model.MetricPoint{
		MetricName:  name,
		Value:       val,
		Timestamp:   time.Now().UTC(),
		Host:        "test-host",
		Service:     "test-service",
		CollectorID: "test-col",
		SequenceNum: 1,
	}
}

func TestJetStreamPublisher_Integration(t *testing.T) {
	// Connect to local NATS container
	pub, err := NewJetStreamPublisher("nats://localhost:4222", "TEST_METRICS_PUB", "test_publisher.>", 100)
	if err != nil {
		t.Skipf("Skipping integration test: NATS not reachable (%v)", err)
		return
	}
	defer pub.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	points := []model.MetricPoint{
		samplePoint("cpu_usage_percent", 45.2),
		samplePoint("memory_usage_percent", 70.1),
	}

	if err := pub.Publish(ctx, points); err != nil {
		t.Fatalf("expected successful publish, got: %v", err)
	}

	if pub.ringBuffer.Len() != 0 {
		t.Fatalf("expected ring buffer to be empty after successful publish, got len: %d", pub.ringBuffer.Len())
	}
}
