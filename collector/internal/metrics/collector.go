package metrics

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/sakshar2303/pulsewatch/pkg/model"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

// Reader defines the interface for collecting system metrics.
type Reader interface {
	Collect(ctx context.Context) ([]model.MetricPoint, error)
}

// SystemCollector captures real hardware and OS metrics using gopsutil.
type SystemCollector struct {
	host        string
	service     string
	collectorID string
	seq         atomic.Uint64
}

// NewSystemCollector initializes a collector with host and service metadata.
func NewSystemCollector(host, service, collectorID string) *SystemCollector {
	return &SystemCollector{
		host:        host,
		service:     service,
		collectorID: collectorID,
	}
}

// Collect reads host telemetry and returns a batch of validated MetricPoints.
func (c *SystemCollector) Collect(ctx context.Context) ([]model.MetricPoint, error) {
	now := time.Now().UTC()
	var points []model.MetricPoint

	// 1. CPU Usage
	cpuPercents, err := cpu.PercentWithContext(ctx, 0, false)
	if err == nil && len(cpuPercents) > 0 {
		points = append(points, c.createPoint("cpu_usage_percent", cpuPercents[0], now, nil))
	}

	// 2. Memory Usage
	vm, err := mem.VirtualMemoryWithContext(ctx)
	if err == nil && vm != nil {
		points = append(points,
			c.createPoint("memory_usage_percent", vm.UsedPercent, now, nil),
			c.createPoint("memory_used_bytes", float64(vm.Used), now, nil),
			c.createPoint("memory_available_bytes", float64(vm.Available), now, nil),
		)
	}

	// 3. Disk Usage (root mount)
	du, err := disk.UsageWithContext(ctx, "/")
	if err == nil && du != nil {
		points = append(points,
			c.createPoint("disk_usage_percent", du.UsedPercent, now, map[string]string{"path": "/"}),
			c.createPoint("disk_free_bytes", float64(du.Free), now, map[string]string{"path": "/"}),
		)
	}

	// 4. Load Average
	avg, err := load.AvgWithContext(ctx)
	if err == nil && avg != nil {
		points = append(points,
			c.createPoint("load_average_1m", avg.Load1, now, nil),
			c.createPoint("load_average_5m", avg.Load5, now, nil),
			c.createPoint("load_average_15m", avg.Load15, now, nil),
		)
	}

	// 5. Network Traffic
	netCounters, err := net.IOCountersWithContext(ctx, false)
	if err == nil && len(netCounters) > 0 {
		points = append(points,
			c.createPoint("network_bytes_sent", float64(netCounters[0].BytesSent), now, nil),
			c.createPoint("network_bytes_recv", float64(netCounters[0].BytesRecv), now, nil),
		)
	}

	if len(points) == 0 {
		return nil, fmt.Errorf("failed to collect any system metrics")
	}

	// Validate all points before returning
	for i := range points {
		if err := points[i].Validate(); err != nil {
			return nil, fmt.Errorf("invalid metric point %s: %w", points[i].MetricName, err)
		}
	}

	return points, nil
}

func (c *SystemCollector) createPoint(name string, value float64, ts time.Time, tags map[string]string) model.MetricPoint {
	return model.MetricPoint{
		MetricName:  name,
		Value:       value,
		Timestamp:   ts,
		Host:        c.host,
		Service:     c.service,
		Tags:        tags,
		CollectorID: c.collectorID,
		SequenceNum: c.seq.Add(1),
	}
}
