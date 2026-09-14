package websocket

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

func TestWebSocket_LiveEndToEnd(t *testing.T) {
	hub := NewHub("")
	go hub.Run()
	defer hub.Close()

	handler := NewHandler(hub)
	server := httptest.NewServer(http.HandlerFunc(handler.ServeWS))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer conn.Close()

	// Send subscribe message
	subMsg := ClientMessage{
		Action:  "subscribe",
		Metrics: []string{"cpu_usage_percent"},
	}
	if err := conn.WriteJSON(subMsg); err != nil {
		t.Fatalf("failed to send subscribe message: %v", err)
	}

	// Give time for subscription processing
	time.Sleep(50 * time.Millisecond)

	// Broadcast metric point
	testPoint := model.MetricPoint{
		MetricName: "cpu_usage_percent",
		Value:      78.4,
		Timestamp:  time.Now().UTC(),
		Host:       "test-node",
		Service:    "test-svc",
	}
	hub.Broadcast(testPoint)

	// Read message from WebSocket
	var out OutgoingMessage
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if err := conn.ReadJSON(&out); err != nil {
		t.Fatalf("failed to read message from websocket: %v", err)
	}

	if out.Type != "metric" {
		t.Fatalf("expected message type 'metric', got '%s'", out.Type)
	}
}
