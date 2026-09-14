package batcher

import (
	"context"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sakshar2303/pulsewatch/pkg/model"
)

// Writer is the minimal interface required by Batcher to flush points.
type Writer interface {
	WriteBatch(ctx context.Context, points []model.MetricPoint) (int, error)
}

// Batcher accumulates incoming metric points in memory and flushes them
// to the writer either when the batch size threshold is reached or when the
// flush interval timer triggers.
type Batcher struct {
	writer        Writer
	batchSize     int
	flushInterval time.Duration
	inputChan     chan model.MetricPoint
	wg            sync.WaitGroup
	stopped       atomic.Bool

	// Operational metrics for observability
	enqueuedCount atomic.Uint64
	flushedCount  atomic.Uint64
	droppedCount  atomic.Uint64
}

// New creates a new Batcher with the specified buffer and flush parameters.
func New(w Writer, batchSize int, flushInterval time.Duration, bufferCapacity int) *Batcher {
	b := &Batcher{
		writer:        w,
		batchSize:     batchSize,
		flushInterval: flushInterval,
		inputChan:     make(chan model.MetricPoint, bufferCapacity),
	}

	b.wg.Add(1)
	go b.runWorker()

	return b
}

// Enqueue adds a metric point to the batch queue.
// Returns true if successfully queued, or false if the queue is saturated.
func (b *Batcher) Enqueue(point model.MetricPoint) bool {
	if b.stopped.Load() {
		b.droppedCount.Add(1)
		return false
	}

	select {
	case b.inputChan <- point:
		b.enqueuedCount.Add(1)
		return true
	default:
		// Queue saturated — backpressure trigger
		b.droppedCount.Add(1)
		return false
	}
}

// EnqueueBatch adds a slice of points, returning how many were queued.
func (b *Batcher) EnqueueBatch(points []model.MetricPoint) int {
	queued := 0
	for _, p := range points {
		if b.Enqueue(p) {
			queued++
		}
	}
	return queued
}

func (b *Batcher) runWorker() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.flushInterval)
	defer ticker.Stop()

	currentBatch := make([]model.MetricPoint, 0, b.batchSize)

	flush := func() {
		if len(currentBatch) == 0 {
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		inserted, err := b.writer.WriteBatch(ctx, currentBatch)
		cancel()

		if err != nil {
			log.Printf("[ERROR] Batcher failed to write batch of %d points: %v", len(currentBatch), err)
		} else {
			b.flushedCount.Add(uint64(inserted))
		}

		// Reset batch
		currentBatch = make([]model.MetricPoint, 0, b.batchSize)
	}

	for {
		select {
		case point, ok := <-b.inputChan:
			if !ok {
				// Channel closed during shutdown — flush any remaining points
				flush()
				return
			}

			currentBatch = append(currentBatch, point)
			if len(currentBatch) >= b.batchSize {
				flush()
			}

		case <-ticker.C:
			flush()
		}
	}
}

// Stats returns operational counters for monitoring.
func (b *Batcher) Stats() (enqueued, flushed, dropped uint64) {
	return b.enqueuedCount.Load(), b.flushedCount.Load(), b.droppedCount.Load()
}

// Stop initiates graceful shutdown: closes the input channel, flushes all
// remaining points to the writer, and waits for worker termination.
func (b *Batcher) Stop() {
	if b.stopped.CompareAndSwap(false, true) {
		close(b.inputChan)
		b.wg.Wait()
	}
}
