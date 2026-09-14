package websocket

import (
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/pkg/model"
)

func TestHub_RegisterAndBroadcast(t *testing.T) {
	hub := NewHub("") // No NATS for unit test
	go hub.Run()
	defer hub.Close()

	client := &Client{
		hub:  hub,
		send: make(chan []byte, 10),
	}

	hub.register <- client

	// Wait for registration
	time.Sleep(50 * time.Millisecond)

	pt := model.MetricPoint{
		MetricName: "cpu_usage_percent",
		Value:      42.5,
		Timestamp:  time.Now().UTC(),
		Host:       "node-1",
		Service:    "backend",
	}

	hub.Broadcast(pt)

	select {
	case msg := <-client.send:
		if len(msg) == 0 {
			t.Fatal("expected non-empty broadcast message")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for broadcast message")
	}

	hub.unregister <- client
}

func TestClient_FilterMatching(t *testing.T) {
	c := &Client{
		filter: SubscriptionFilter{
			Metrics:  map[string]bool{"cpu_usage_percent": true},
			Services: map[string]bool{"api-gateway": true},
		},
	}

	matchPoint := model.MetricPoint{
		MetricName: "cpu_usage_percent",
		Service:    "api-gateway",
		Host:       "host-1",
	}

	nonMatchMetric := model.MetricPoint{
		MetricName: "memory_usage_percent",
		Service:    "api-gateway",
		Host:       "host-1",
	}

	nonMatchService := model.MetricPoint{
		MetricName: "cpu_usage_percent",
		Service:    "worker",
		Host:       "host-1",
	}

	if !c.matches(matchPoint) {
		t.Fatal("expected matchPoint to match filter")
	}
	if c.matches(nonMatchMetric) {
		t.Fatal("expected nonMatchMetric NOT to match filter")
	}
	if c.matches(nonMatchService) {
		t.Fatal("expected nonMatchService NOT to match filter")
	}
}
