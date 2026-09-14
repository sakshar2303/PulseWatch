package buffer

import (
	"sync"
	"sync/atomic"

	"github.com/sakshar2303/pulsewatch/pkg/model"
)

// RingBuffer provides a thread-safe, bounded, in-memory FIFO buffer for metric points.
// If the buffer reaches its maximum capacity, new items overwrite the oldest items (eviction),
// ensuring the collector never consumes unbounded memory or blocks host threads.
type RingBuffer struct {
	mu           sync.Mutex
	data         []model.MetricPoint
	head         int // Index of oldest element
	tail         int // Index of next write
	count        int
	capacity     int
	droppedCount atomic.Uint64
}

// NewRingBuffer allocates a ring buffer with the specified capacity.
func NewRingBuffer(capacity int) *RingBuffer {
	if capacity <= 0 {
		capacity = 1000
	}
	return &RingBuffer{
		data:     make([]model.MetricPoint, capacity),
		capacity: capacity,
	}
}

// Push adds a MetricPoint to the buffer.
// If the buffer is full, the oldest point is dropped and the drop counter increments.
func (r *RingBuffer) Push(pt model.MetricPoint) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.data[r.tail] = pt
	r.tail = (r.tail + 1) % r.capacity

	if r.count == r.capacity {
		// Buffer full: advance head to discard oldest item
		r.head = (r.head + 1) % r.capacity
		r.droppedCount.Add(1)
	} else {
		r.count++
	}
}

// PushBatch adds multiple points to the buffer.
func (r *RingBuffer) PushBatch(pts []model.MetricPoint) {
	for _, pt := range pts {
		r.Push(pt)
	}
}

// PopBatch removes and returns up to maxItems from the buffer in FIFO order.
func (r *RingBuffer) PopBatch(maxItems int) []model.MetricPoint {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.count == 0 || maxItems <= 0 {
		return nil
	}

	n := maxItems
	if n > r.count {
		n = r.count
	}

	result := make([]model.MetricPoint, n)
	for i := 0; i < n; i++ {
		result[i] = r.data[r.head]
		r.head = (r.head + 1) % r.capacity
	}
	r.count -= n

	return result
}

// Len returns the current number of buffered points.
func (r *RingBuffer) Len() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.count
}

// Cap returns the maximum capacity of the buffer.
func (r *RingBuffer) Cap() int {
	return r.capacity
}

// Dropped returns the total number of points evicted due to capacity saturation.
func (r *RingBuffer) Dropped() uint64 {
	return r.droppedCount.Load()
}
