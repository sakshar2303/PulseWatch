package publisher

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/sakshar2303/pulsewatch/collector/internal/buffer"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

// Publisher defines the transmission contract for metric batches.
type Publisher interface {
	Publish(ctx context.Context, points []model.MetricPoint) error
	Close()
}

// JetStreamPublisher publishes metric points to NATS JetStream.
// If NATS is temporarily disconnected, incoming points are stored in a local bounded ring buffer
// and drained automatically upon reconnection.
type JetStreamPublisher struct {
	nc         *nats.Conn
	js         nats.JetStreamContext
	ringBuffer *buffer.RingBuffer
	streamName string
}

// NewJetStreamPublisher establishes connection to NATS, ensures stream existence, and returns a publisher.
func NewJetStreamPublisher(natsURL, streamName, subjectPattern string, ringCap int) (*JetStreamPublisher, error) {
	opts := []nats.Option{
		nats.Name("pulsewatch-collector"),
		nats.Timeout(5 * time.Second),
		nats.ReconnectWait(1 * time.Second),
		nats.MaxReconnects(-1), // Reconnect indefinitely
		nats.DisconnectErrHandler(func(c *nats.Conn, err error) {
			log.Printf("[WARN] NATS disconnected: %v. Buffering metrics locally...", err)
		}),
		nats.ReconnectHandler(func(c *nats.Conn) {
			log.Printf("[INFO] NATS reconnected to %s. Resuming JetStream publishing...", c.ConnectedUrl())
		}),
	}

	nc, err := nats.Connect(natsURL, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS at %s: %w", natsURL, err)
	}

	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to get JetStream context: %w", err)
	}

	if subjectPattern == "" {
		subjectPattern = "metrics.>"
	}

	// Ensure the stream exists (idempotent create/update)
	streamCfg := &nats.StreamConfig{
		Name:      streamName,
		Subjects:  []string{subjectPattern},
		Storage:   nats.FileStorage,
		Retention: nats.LimitsPolicy,
		Discard:   nats.DiscardOld,
		MaxAge:    1 * time.Hour,
		MaxBytes:  1024 * 1024 * 1024, // 1 GB
	}

	_, err = js.AddStream(streamCfg)
	if err != nil && !strings.Contains(err.Error(), "already in use") && !strings.Contains(err.Error(), "stream name already in use") {
		// Try updating stream if it already exists with compatible configuration
		_, updateErr := js.UpdateStream(streamCfg)
		if updateErr != nil {
			log.Printf("[WARN] Notice on stream %s initialization: %v", streamName, err)
		}
	}

	rb := buffer.NewRingBuffer(ringCap)

	return &JetStreamPublisher{
		nc:         nc,
		js:         js,
		ringBuffer: rb,
		streamName: streamName,
	}, nil
}

// Publish transmits points to NATS JetStream on subject metrics.<service>.<name>.
// If NATS connection is down, points are enqueued into the local ring buffer.
func (p *JetStreamPublisher) Publish(ctx context.Context, points []model.MetricPoint) error {
	// First: drain any previously buffered points if connection is healthy
	if p.nc.IsConnected() && p.ringBuffer.Len() > 0 {
		p.drainLocalBuffer(ctx)
	}

	// If disconnected, divert to local buffer immediately
	if !p.nc.IsConnected() {
		p.ringBuffer.PushBatch(points)
		return fmt.Errorf("nats disconnected: buffered %d points locally (total buffered: %d, dropped: %d)",
			len(points), p.ringBuffer.Len(), p.ringBuffer.Dropped())
	}

	var publishErrors []string

	for _, pt := range points {
		data, err := json.Marshal(pt)
		if err != nil {
			publishErrors = append(publishErrors, fmt.Sprintf("marshal %s: %v", pt.MetricName, err))
			continue
		}

		// Subject format: metrics.<service>.<metric_name>
		cleanService := strings.ReplaceAll(pt.Service, " ", "_")
		subject := fmt.Sprintf("metrics.%s.%s", cleanService, pt.MetricName)

		_, err = p.js.Publish(subject, data, nats.Context(ctx))
		if err != nil {
			// Failed publish: buffer point locally for replay
			p.ringBuffer.Push(pt)
			publishErrors = append(publishErrors, fmt.Sprintf("publish %s: %v", pt.MetricName, err))
		}
	}

	if len(publishErrors) > 0 {
		return fmt.Errorf("encountered %d publish errors (buffered for retry): %s", len(publishErrors), strings.Join(publishErrors, "; "))
	}

	return nil
}

func (p *JetStreamPublisher) drainLocalBuffer(ctx context.Context) {
	for p.ringBuffer.Len() > 0 {
		batch := p.ringBuffer.PopBatch(100)
		for _, pt := range batch {
			data, err := json.Marshal(pt)
			if err != nil {
				continue
			}
			cleanService := strings.ReplaceAll(pt.Service, " ", "_")
			subject := fmt.Sprintf("metrics.%s.%s", cleanService, pt.MetricName)
			if _, err := p.js.Publish(subject, data, nats.Context(ctx)); err != nil {
				// Put back if publish fails during drain
				p.ringBuffer.Push(pt)
				return
			}
		}
	}
}

// Close closes the NATS connection cleanly.
func (p *JetStreamPublisher) Close() {
	if p.nc != nil {
		_ = p.nc.Drain()
		p.nc.Close()
	}
}
