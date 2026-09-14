package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/sakshar2303/pulsewatch/pkg/model"
)

type LatencyTracker struct {
	mu        sync.Mutex
	durations []time.Duration
}

func (l *LatencyTracker) Add(d time.Duration) {
	l.mu.Lock()
	l.durations = append(l.durations, d)
	l.mu.Unlock()
}

func (l *LatencyTracker) Percentiles() (min, p50, p90, p95, p99, max time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if len(l.durations) == 0 {
		return
	}

	sort.Slice(l.durations, func(i, j int) bool {
		return l.durations[i] < l.durations[j]
	})

	n := len(l.durations)
	min = l.durations[0]
	p50 = l.durations[int(float64(n)*0.50)]
	p90 = l.durations[int(float64(n)*0.90)]
	p95 = l.durations[int(float64(n)*0.95)]
	p99 = l.durations[int(float64(n)*0.99)]
	max = l.durations[n-1]
	return
}

func main() {
	mode := flag.String("mode", "nats", "Target transport mode: 'nats' or 'http'")
	workers := flag.Int("workers", 10, "Number of concurrent simulated host workers")
	rate := flag.Int("rate", 100, "Target points per second per worker")
	duration := flag.Duration("duration", 10*time.Second, "Test run duration")
	targetURL := flag.String("url", "", "Target URL (defaults to nats://localhost:4222 or http://localhost:8081/api/v1/metrics)")
	batchSize := flag.Int("batch", 10, "Points per batch transmit")
	flag.Parse()

	if *targetURL == "" {
		if *mode == "http" {
			*targetURL = "http://localhost:8081/api/v1/metrics"
		} else {
			*targetURL = "nats://localhost:4222"
		}
	}

	log.Printf("==========================================================")
	log.Printf("PulseWatch Synthetic Load Generator")
	log.Printf("Mode:       %s", *mode)
	log.Printf("Target URL: %s", *targetURL)
	log.Printf("Workers:    %d", *workers)
	log.Printf("Rate:       %d pts/sec/worker (~%d target pts/sec total)", *rate, *workers*(*rate))
	log.Printf("Batch Size: %d pts", *batchSize)
	log.Printf("Duration:   %s", *duration)
	log.Printf("==========================================================")

	var totalSent atomic.Uint64
	var totalSuccess atomic.Uint64
	var totalFailed atomic.Uint64
	tracker := &LatencyTracker{durations: make([]time.Duration, 0, 50000)}

	ctx, cancel := context.WithTimeout(context.Background(), *duration)
	defer cancel()

	var wg sync.WaitGroup

	startTime := time.Now()

	for w := 0; w < *workers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			runWorker(ctx, *mode, *targetURL, workerID, *rate, *batchSize, &totalSent, &totalSuccess, &totalFailed, tracker)
		}(w)
	}

	wg.Wait()
	elapsed := time.Since(startTime)

	sent := totalSent.Load()
	success := totalSuccess.Load()
	failed := totalFailed.Load()

	throughput := float64(success) / elapsed.Seconds()
	min, p50, p90, p95, p99, max := tracker.Percentiles()

	fmt.Println()
	fmt.Println("==========================================================")
	fmt.Println("                   BENCHMARK RESULTS                      ")
	fmt.Println("==========================================================")
	fmt.Printf("Transport Mode:       %s\n", *mode)
	fmt.Printf("Elapsed Time:         %s\n", elapsed.Round(time.Millisecond))
	fmt.Printf("Total Points Sent:    %d\n", sent)
	fmt.Printf("Total Succeeded:      %d\n", success)
	fmt.Printf("Total Failed/Dropped: %d (%.2f%% loss)\n", failed, float64(failed)/float64(sent+1)*100)
	fmt.Printf("Actual Throughput:    %.2f points/sec\n", throughput)
	fmt.Println("----------------------------------------------------------")
	fmt.Println("Latency Distribution (round-trip per batch):")
	fmt.Printf("  Min:   %s\n", min.Round(time.Microsecond))
	fmt.Printf("  p50:   %s\n", p50.Round(time.Microsecond))
	fmt.Printf("  p90:   %s\n", p90.Round(time.Microsecond))
	fmt.Printf("  p95:   %s\n", p95.Round(time.Microsecond))
	fmt.Printf("  p99:   %s\n", p99.Round(time.Microsecond))
	fmt.Printf("  Max:   %s\n", max.Round(time.Microsecond))
	fmt.Println("==========================================================")
}

func runWorker(ctx context.Context, mode, targetURL string, workerID, rate, batchSize int,
	totalSent, totalSuccess, totalFailed *atomic.Uint64, tracker *LatencyTracker) {

	hostName := fmt.Sprintf("synthetic-host-%03d", workerID)
	serviceName := fmt.Sprintf("service-%d", workerID%5)
	collectorID := fmt.Sprintf("loadgen-%03d", workerID)

	// Batches per second
	batchesPerSec := rate / batchSize
	if batchesPerSec <= 0 {
		batchesPerSec = 1
	}
	interval := time.Second / time.Duration(batchesPerSec)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	var httpClient *http.Client
	var nc *nats.Conn
	var js nats.JetStreamContext

	if mode == "http" {
		httpClient = &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        50,
				MaxIdleConnsPerHost: 50,
				IdleConnTimeout:     30 * time.Second,
			},
		}
	} else {
		var err error
		nc, err = nats.Connect(targetURL, nats.Timeout(5*time.Second))
		if err != nil {
			log.Printf("[Worker %d] Failed to connect to NATS: %v", workerID, err)
			return
		}
		defer nc.Close()

		js, err = nc.JetStream()
		if err != nil {
			log.Printf("[Worker %d] Failed to get JetStream: %v", workerID, err)
			return
		}
	}

	seq := uint64(0)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			points := make([]model.MetricPoint, batchSize)
			now := time.Now().UTC()
			for i := 0; i < batchSize; i++ {
				seq++
				metricNames := []string{"cpu_usage_percent", "memory_usage_percent", "disk_usage_percent", "network_bytes_sent"}
				mName := metricNames[rand.Intn(len(metricNames))]
				points[i] = model.MetricPoint{
					MetricName:  mName,
					Value:       20.0 + rand.Float64()*70.0,
					Timestamp:   now,
					Host:        hostName,
					Service:     serviceName,
					CollectorID: collectorID,
					SequenceNum: seq,
					Tags:        map[string]string{"env": "loadtest"},
				}
			}

			totalSent.Add(uint64(batchSize))

			start := time.Now()
			var err error

			if mode == "http" {
				payload, _ := json.Marshal(points)
				req, _ := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(payload))
				req.Header.Set("Content-Type", "application/json")
				resp, doErr := httpClient.Do(req)
				if doErr != nil {
					err = doErr
				} else {
					_, _ = io.Copy(io.Discard, resp.Body)
					_ = resp.Body.Close()
					if resp.StatusCode < 200 || resp.StatusCode >= 300 {
						err = fmt.Errorf("status: %d", resp.StatusCode)
					}
				}
			} else {
				// NATS mode: publish to subject
				for _, pt := range points {
					data, _ := json.Marshal(pt)
					subject := fmt.Sprintf("metrics.%s.%s", pt.Service, pt.MetricName)
					_, pubErr := js.Publish(subject, data, nats.Context(ctx))
					if pubErr != nil {
						err = pubErr
						break
					}
				}
			}

			dur := time.Since(start)
			tracker.Add(dur)

			if err != nil {
				totalFailed.Add(uint64(batchSize))
			} else {
				totalSuccess.Add(uint64(batchSize))
			}
		}
	}
}
