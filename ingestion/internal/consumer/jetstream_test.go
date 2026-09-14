package consumer

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

type mockConsumerWriter struct {
	mu           sync.Mutex
	writtenCount atomic.Int32
	points       []model.MetricPoint
}

func (m *mockConsumerWriter) WriteBatch(ctx context.Context, points []model.MetricPoint) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.writtenCount.Add(int32(len(points)))
	m.points = append(m.points, points...)
	return len(points), nil
}

func (m *mockConsumerWriter) Ping(ctx context.Context) error { return nil }
func (m *mockConsumerWriter) Close()                        {}

func TestJetStreamConsumer_Integration(t *testing.T) {
	natsURL := "nats://localhost:4222"
	streamName := "TEST_INGESTION_STREAM"
	consumerName := "test-worker"

	nc, err := nats.Connect(natsURL)
	if err != nil {
		t.Skipf("Skipping integration test: NATS unreachable: %v", err)
		return
	}
	defer nc.Close()

	js, err := nc.JetStream()
	if err != nil {
		t.Skipf("JetStream not available: %v", err)
		return
	}

	// Clean up prior stream if any
	_ = js.DeleteStream(streamName)

	mw := &mockConsumerWriter{}
	cons, err := NewJetStreamConsumer(natsURL, streamName, consumerName, "test_consumer.>", mw, 50, 100*time.Millisecond)
	if err != nil {
		t.Fatalf("failed to create consumer: %v", err)
	}
	defer cons.Stop()

	// Publish 5 test messages
	for i := 1; i <= 5; i++ {
		pt := model.MetricPoint{
			MetricName:  "cpu_usage_percent",
			Value:       float64(50 + i),
			Timestamp:   time.Now().UTC(),
			Host:        "test-host",
			Service:     "test-service",
			CollectorID: "test-col",
			SequenceNum: uint64(i),
		}
		data, _ := json.Marshal(pt)
		_, err := js.Publish("test_consumer.test-service.cpu_usage_percent", data)
		if err != nil {
			t.Fatalf("failed to publish test point: %v", err)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cons.Start(ctx)

	// Wait up to 3s for batch to be pulled and processed
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if mw.writtenCount.Load() >= 5 {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	if mw.writtenCount.Load() != 5 {
		t.Fatalf("expected 5 points written by consumer, got %d", mw.writtenCount.Load())
	}

	consumed, acked, naked := cons.Stats()
	if consumed != 5 || acked != 5 || naked != 0 {
		t.Fatalf("unexpected stats: consumed=%d acked=%d naked=%d", consumed, acked, naked)
	}
}
