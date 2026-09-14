package batcher

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/pkg/model"
)

type mockWriter struct {
	mu           sync.Mutex
	flushedTotal atomic.Int32
	flushedCalls atomic.Int32
	points       []model.MetricPoint
}

func (m *mockWriter) WriteBatch(ctx context.Context, points []model.MetricPoint) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.flushedTotal.Add(int32(len(points)))
	m.flushedCalls.Add(1)
	m.points = append(m.points, points...)
	return len(points), nil
}

func samplePoint(seq uint64) model.MetricPoint {
	return model.MetricPoint{
		MetricName:  "cpu_usage_percent",
		Value:       42.0,
		Timestamp:   time.Now().UTC(),
		Host:        "host-1",
		Service:     "service-1",
		CollectorID: "col-1",
		SequenceNum: seq,
	}
}

func TestBatcher_FlushOnSize(t *testing.T) {
	w := &mockWriter{}
	// Batch size 5, long timer (10s)
	b := New(w, 5, 10*time.Second, 100)
	defer b.Stop()

	for i := 1; i <= 5; i++ {
		b.Enqueue(samplePoint(uint64(i)))
	}

	// Give worker a brief moment to execute flush
	time.Sleep(50 * time.Millisecond)

	if w.flushedTotal.Load() != 5 {
		t.Fatalf("expected 5 points flushed on size trigger, got %d", w.flushedTotal.Load())
	}
	if w.flushedCalls.Load() != 1 {
		t.Fatalf("expected exactly 1 flush call, got %d", w.flushedCalls.Load())
	}
}

func TestBatcher_FlushOnTimer(t *testing.T) {
	w := &mockWriter{}
	// Batch size 100, short timer (50ms)
	b := New(w, 100, 50*time.Millisecond, 100)
	defer b.Stop()

	// Enqueue 3 points (less than batch size)
	for i := 1; i <= 3; i++ {
		b.Enqueue(samplePoint(uint64(i)))
	}

	// Wait for timer to trigger
	time.Sleep(120 * time.Millisecond)

	if w.flushedTotal.Load() != 3 {
		t.Fatalf("expected 3 points flushed on timer, got %d", w.flushedTotal.Load())
	}
}

func TestBatcher_GracefulDrainOnStop(t *testing.T) {
	w := &mockWriter{}
	b := New(w, 100, 10*time.Second, 100)

	for i := 1; i <= 7; i++ {
		b.Enqueue(samplePoint(uint64(i)))
	}

	// Stop immediately — should drain all 7 points before returning
	b.Stop()

	if w.flushedTotal.Load() != 7 {
		t.Fatalf("expected 7 points drained and flushed on Stop, got %d", w.flushedTotal.Load())
	}
}

func TestBatcher_QueueSaturation_Backpressure(t *testing.T) {
	w := &mockWriter{}
	// Tiny buffer of 2
	b := New(w, 100, 10*time.Second, 2)
	defer b.Stop()

	// Fill buffer
	p1 := b.Enqueue(samplePoint(1))
	p2 := b.Enqueue(samplePoint(2))
	p3 := b.Enqueue(samplePoint(3)) // should drop

	if !p1 || !p2 {
		t.Errorf("expected first 2 enqueues to succeed")
	}
	if p3 {
		t.Errorf("expected 3rd enqueue to be dropped due to saturation")
	}

	_, _, dropped := b.Stats()
	if dropped != 1 {
		t.Fatalf("expected 1 dropped point in stats, got %d", dropped)
	}
}
