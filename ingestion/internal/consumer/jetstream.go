package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/sakshar2303/pulsewatch/ingestion/internal/writer"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

// JetStreamConsumer coordinates pull-based batch consumption from NATS JetStream
// into the TimescaleDB writer with explicit acknowledgments.
type JetStreamConsumer struct {
	nc           *nats.Conn
	js           nats.JetStreamContext
	sub          *nats.Subscription
	writer       writer.Writer
	batchSize    int
	fetchTimeout time.Duration
	wg           sync.WaitGroup
	stopped      atomic.Bool

	// Operational counters
	consumedCount atomic.Uint64
	ackedCount    atomic.Uint64
	nakedCount    atomic.Uint64
}

// NewJetStreamConsumer connects to NATS, initializes the pull consumer, and returns a consumer instance.
func NewJetStreamConsumer(natsURL, streamName, consumerName, subjectPattern string, w writer.Writer, batchSize int, fetchTimeout time.Duration) (*JetStreamConsumer, error) {
	opts := []nats.Option{
		nats.Name("pulsewatch-ingestion-consumer"),
		nats.Timeout(5 * time.Second),
		nats.ReconnectWait(1 * time.Second),
		nats.MaxReconnects(-1),
	}

	nc, err := nats.Connect(natsURL, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS at %s: %w", natsURL, err)
	}

	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to obtain JetStream context: %w", err)
	}

	if subjectPattern == "" {
		subjectPattern = "metrics.>"
	}

	// Ensure stream exists
	streamCfg := &nats.StreamConfig{
		Name:      streamName,
		Subjects:  []string{subjectPattern},
		Storage:   nats.FileStorage,
		Retention: nats.LimitsPolicy,
		Discard:   nats.DiscardOld,
		MaxAge:    1 * time.Hour,
		MaxBytes:  1024 * 1024 * 1024,
	}
	_, err = js.AddStream(streamCfg)
	if err != nil && !strings.Contains(err.Error(), "already in use") {
		log.Printf("[WARN] Notice on stream %s verification: %v", streamName, err)
	}

	// Pull-based durable subscription
	sub, err := js.PullSubscribe(subjectPattern, consumerName,
		nats.BindStream(streamName),
		nats.AckExplicit(),
		nats.MaxDeliver(5),
		nats.DeliverAll(),
	)
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to bind pull subscription for stream %s consumer %s: %w", streamName, consumerName, err)
	}

	return &JetStreamConsumer{
		nc:           nc,
		js:           js,
		sub:          sub,
		writer:       w,
		batchSize:    batchSize,
		fetchTimeout: fetchTimeout,
	}, nil
}

// Start launches the background pull-consumer loop.
func (c *JetStreamConsumer) Start(ctx context.Context) {
	c.wg.Add(1)
	go c.runLoop(ctx)
}

func (c *JetStreamConsumer) runLoop(ctx context.Context) {
	defer c.wg.Done()
	log.Printf("[INFO] JetStream pull consumer started (batch_size=%d, timeout=%s)", c.batchSize, c.fetchTimeout)

	for {
		if c.stopped.Load() || ctx.Err() != nil {
			return
		}

		// Fetch a batch of messages up to batchSize
		msgs, err := c.sub.Fetch(c.batchSize, nats.MaxWait(c.fetchTimeout))
		if err != nil {
			if errors.Is(err, nats.ErrTimeout) {
				// No messages available during this poll window — continue loop
				continue
			}
			if errors.Is(err, nats.ErrBadSubscription) || errors.Is(err, nats.ErrConnectionClosed) {
				return
			}
			log.Printf("[WARN] JetStream fetch warning: %v", err)
			time.Sleep(100 * time.Millisecond)
			continue
		}

		if len(msgs) == 0 {
			continue
		}

		c.consumedCount.Add(uint64(len(msgs)))
		c.processBatch(ctx, msgs)
	}
}

func (c *JetStreamConsumer) processBatch(ctx context.Context, msgs []*nats.Msg) {
	points := make([]model.MetricPoint, 0, len(msgs))
	validMsgs := make([]*nats.Msg, 0, len(msgs))

	for _, msg := range msgs {
		var pt model.MetricPoint
		if err := json.Unmarshal(msg.Data, &pt); err != nil {
			log.Printf("[WARN] Dropping malformed JetStream message: %v", err)
			_ = msg.Term() // Terminate poison message so it isn't redelivered
			continue
		}

		if err := pt.Validate(); err != nil {
			log.Printf("[WARN] Dropping invalid metric point: %v", err)
			_ = msg.Term()
			continue
		}

		points = append(points, pt)
		validMsgs = append(validMsgs, msg)
	}

	if len(points) == 0 {
		return
	}

	// Write batch to TimescaleDB
	writeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	_, err := c.writer.WriteBatch(writeCtx, points)
	cancel()

	if err != nil {
		log.Printf("[ERROR] Database write failed for %d points: %v. Nak-ing batch with backoff delay...", len(points), err)
		for _, msg := range validMsgs {
			_ = msg.NakWithDelay(1 * time.Second) // Delay redelivery to avoid hammering DB
			c.nakedCount.Add(1)
		}
		return
	}

	// Acknowledge all successfully persisted messages
	for _, msg := range validMsgs {
		if err := msg.Ack(); err == nil {
			c.ackedCount.Add(1)
		}
	}
}

// Stats returns operational metrics for monitoring.
func (c *JetStreamConsumer) Stats() (consumed, acked, naked uint64) {
	return c.consumedCount.Load(), c.ackedCount.Load(), c.nakedCount.Load()
}

// Stop initiates clean teardown: stops polling, drains subscription, and closes NATS.
func (c *JetStreamConsumer) Stop() {
	if c.stopped.CompareAndSwap(false, true) {
		if c.sub != nil {
			_ = c.sub.Drain()
		}
		c.wg.Wait()
		if c.nc != nil {
			_ = c.nc.Drain()
			c.nc.Close()
		}
		log.Println("[INFO] JetStream pull consumer stopped cleanly.")
	}
}
