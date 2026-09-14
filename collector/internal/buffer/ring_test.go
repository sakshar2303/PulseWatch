package buffer

import (
	"sync"
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/pkg/model"
)

func makePoint(seq uint64) model.MetricPoint {
	return model.MetricPoint{
		MetricName:  "cpu",
		Value:       float64(seq),
		Timestamp:   time.Now().UTC(),
		Host:        "host",
		Service:     "svc",
		CollectorID: "col",
		SequenceNum: seq,
	}
}

func TestRingBuffer_FIFO(t *testing.T) {
	rb := NewRingBuffer(5)

	rb.Push(makePoint(1))
	rb.Push(makePoint(2))
	rb.Push(makePoint(3))

	if rb.Len() != 3 {
		t.Fatalf("expected len 3, got %d", rb.Len())
	}

	pts := rb.PopBatch(2)
	if len(pts) != 2 {
		t.Fatalf("expected 2 popped, got %d", len(pts))
	}
	if pts[0].SequenceNum != 1 || pts[1].SequenceNum != 2 {
		t.Fatalf("expected points 1, 2 in FIFO order, got %d, %d", pts[0].SequenceNum, pts[1].SequenceNum)
	}

	if rb.Len() != 1 {
		t.Fatalf("expected 1 remaining, got %d", rb.Len())
	}
}

func TestRingBuffer_Overflow_DropsOldest(t *testing.T) {
	rb := NewRingBuffer(3)

	// Push 5 items into capacity-3 buffer: 1, 2, 3, 4, 5
	// Items 1 and 2 must be evicted; items 3, 4, 5 must remain.
	for i := uint64(1); i <= 5; i++ {
		rb.Push(makePoint(i))
	}

	if rb.Len() != 3 {
		t.Fatalf("expected len 3, got %d", rb.Len())
	}
	if rb.Dropped() != 2 {
		t.Fatalf("expected 2 dropped, got %d", rb.Dropped())
	}

	pts := rb.PopBatch(3)
	if len(pts) != 3 {
		t.Fatalf("expected 3 popped, got %d", len(pts))
	}
	if pts[0].SequenceNum != 3 || pts[1].SequenceNum != 4 || pts[2].SequenceNum != 5 {
		t.Fatalf("expected retained points to be 3, 4, 5; got %d, %d, %d",
			pts[0].SequenceNum, pts[1].SequenceNum, pts[2].SequenceNum)
	}
}

func TestRingBuffer_ConcurrentAccess(t *testing.T) {
	rb := NewRingBuffer(50)
	var wg sync.WaitGroup

	// 5 concurrent pushers
	for p := 0; p < 5; p++ {
		wg.Add(1)
		go func(pusherID int) {
			defer wg.Done()
			for i := 0; i < 100; i++ {
				rb.Push(makePoint(uint64(i)))
			}
		}(p)
	}

	// 2 concurrent poppers
	for c := 0; c < 2; c++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 50; i++ {
				_ = rb.PopBatch(5)
			}
		}()
	}

	wg.Wait()
}
