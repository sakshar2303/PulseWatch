package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// SubscriptionFilter filters metrics forwarded to a client.
type SubscriptionFilter struct {
	Metrics  map[string]bool
	Services map[string]bool
	Hosts    map[string]bool
}

// Client represents a single active WebSocket client connection.
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	filter SubscriptionFilter
	mu     sync.RWMutex
}

// ClientMessage represents an incoming message from the client.
type ClientMessage struct {
	Action   string   `json:"action"`
	Metrics  []string `json:"metrics,omitempty"`
	Services []string `json:"services,omitempty"`
	Hosts    []string `json:"hosts,omitempty"`
}

// OutgoingMessage represents a message sent to the client.
type OutgoingMessage struct {
	Type string `json:"type"`
	Data any    `json:"data,omitempty"`
}

// Hub maintains the set of active clients and broadcasts metric events.
type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan model.MetricPoint
	nc         *nats.Conn
	sub        *nats.Subscription
	mu         sync.RWMutex
	stopChan   chan struct{}
}

// NewHub creates a new WebSocket Hub.
func NewHub(natsURL string) *Hub {
	h := &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan model.MetricPoint, 1024),
		stopChan:   make(chan struct{}),
	}

	if natsURL != "" {
		nc, err := nats.Connect(natsURL, nats.Timeout(3*time.Second), nats.MaxReconnects(10))
		if err != nil {
			log.Printf("[WARN] WebSocket Hub could not connect to NATS (%s): %v. Live streaming via NATS disabled.", natsURL, err)
		} else {
			h.nc = nc
			log.Printf("[INFO] WebSocket Hub connected to NATS at %s", natsURL)

			// Subscribe to metrics.>
			sub, err := nc.Subscribe("metrics.>", func(msg *nats.Msg) {
				var point model.MetricPoint
				if err := json.Unmarshal(msg.Data, &point); err == nil {
					h.Broadcast(point)
				}
			})
			if err != nil {
				log.Printf("[WARN] WebSocket Hub failed to subscribe to metrics.>: %v", err)
			} else {
				h.sub = sub
				log.Println("[INFO] WebSocket Hub subscribed to metrics.> subject.")
			}
		}
	}

	return h
}

// Run starts the hub's main coordination loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case point := <-h.broadcast:
			h.mu.RLock()
			msgPayload, err := json.Marshal(OutgoingMessage{
				Type: "metric",
				Data: point,
			})
			if err != nil {
				h.mu.RUnlock()
				continue
			}

			for client := range h.clients {
				if client.matches(point) {
					select {
					case client.send <- msgPayload:
					default:
						// Client buffer full; disconnect slow reader
						close(client.send)
						delete(h.clients, client)
					}
				}
			}
			h.mu.RUnlock()

		case <-h.stopChan:
			h.mu.Lock()
			for client := range h.clients {
				close(client.send)
				delete(h.clients, client)
			}
			h.mu.Unlock()
			return
		}
	}
}

// Broadcast enqueues a metric point to be forwarded to clients.
func (h *Hub) Broadcast(point model.MetricPoint) {
	select {
	case h.broadcast <- point:
	default:
		// Drop if hub broadcast queue is momentarily saturated to avoid blocking publishers
	}
}

// Close gracefully stops the hub and releases connections.
func (h *Hub) Close() {
	close(h.stopChan)
	if h.sub != nil {
		_ = h.sub.Unsubscribe()
	}
	if h.nc != nil {
		h.nc.Close()
	}
}

func (c *Client) matches(point model.MetricPoint) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if len(c.filter.Metrics) > 0 && !c.filter.Metrics[point.MetricName] {
		return false
	}
	if len(c.filter.Services) > 0 && !c.filter.Services[point.Service] {
		return false
	}
	if len(c.filter.Hosts) > 0 && !c.filter.Hosts[point.Host] {
		return false
	}
	return true
}

func (c *Client) updateSubscription(msg ClientMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()

	switch msg.Action {
	case "subscribe":
		if c.filter.Metrics == nil {
			c.filter.Metrics = make(map[string]bool)
		}
		if c.filter.Services == nil {
			c.filter.Services = make(map[string]bool)
		}
		if c.filter.Hosts == nil {
			c.filter.Hosts = make(map[string]bool)
		}

		for _, m := range msg.Metrics {
			c.filter.Metrics[m] = true
		}
		for _, s := range msg.Services {
			c.filter.Services[s] = true
		}
		for _, h := range msg.Hosts {
			c.filter.Hosts[h] = true
		}

	case "unsubscribe":
		for _, m := range msg.Metrics {
			delete(c.filter.Metrics, m)
		}
		for _, s := range msg.Services {
			delete(c.filter.Services, s)
		}
		for _, h := range msg.Hosts {
			delete(c.filter.Hosts, h)
		}

	case "reset":
		c.filter = SubscriptionFilter{}
	}
}
