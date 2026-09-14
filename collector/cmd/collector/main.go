package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sakshar2303/pulsewatch/collector/internal/client"
	"github.com/sakshar2303/pulsewatch/collector/internal/config"
	"github.com/sakshar2303/pulsewatch/collector/internal/metrics"
)

func main() {
	log.Println("[INFO] Starting PulseWatch Collector Agent...")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load configuration: %v", err)
	}

	log.Printf("[INFO] Configured collector: id=%s host=%s service=%s interval=%s endpoint=%s",
		cfg.CollectorID, cfg.Host, cfg.Service, cfg.Interval, cfg.IngestionURL)

	collector := metrics.NewSystemCollector(cfg.Host, cfg.Service, cfg.CollectorID)
	httpClient := client.NewHTTPClient(cfg.IngestionURL, cfg.HTTPTimeout, cfg.RetryBackoff, cfg.MaxRetries)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Capture OS interrupt signals for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	// Run initial collection immediately
	collectAndSend(ctx, collector, httpClient)

	log.Printf("[INFO] Collector agent running on %s ticker. Press Ctrl+C to terminate.", cfg.Interval)

	for {
		select {
		case <-ticker.C:
			collectAndSend(ctx, collector, httpClient)

		case sig := <-sigChan:
			log.Printf("[INFO] Received signal %s. Shutting down collector gracefully...", sig)
			// Allow in-flight operations a small grace window
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer shutdownCancel()
			_ = shutdownCtx
			log.Println("[INFO] Collector agent stopped cleanly.")
			return
		}
	}
}

func collectAndSend(ctx context.Context, c *metrics.SystemCollector, cl *client.HTTPClient) {
	start := time.Now()
	points, err := c.Collect(ctx)
	if err != nil {
		log.Printf("[WARN] Error collecting system metrics: %v", err)
		return
	}

	err = cl.SendMetrics(ctx, points)
	if err != nil {
		log.Printf("[ERROR] Failed to send %d metric points to ingestion: %v", len(points), err)
		return
	}

	log.Printf("[INFO] Successfully sent %d metric points (took %s)", len(points), time.Since(start).Round(time.Millisecond))
}
