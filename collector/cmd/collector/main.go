package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/sakshar2303/pulsewatch/collector/internal/client"
	"github.com/sakshar2303/pulsewatch/collector/internal/config"
	"github.com/sakshar2303/pulsewatch/collector/internal/metrics"
	"github.com/sakshar2303/pulsewatch/collector/internal/publisher"
	"github.com/sakshar2303/pulsewatch/pkg/model"
	pwotel "github.com/sakshar2303/pulsewatch/pkg/otel"
)

// MetricSender abstracts the delivery mechanism (NATS or HTTP).
type MetricSender interface {
	Send(ctx context.Context, points []model.MetricPoint) error
	Close()
}

type httpSender struct {
	client *client.HTTPClient
}

func (h *httpSender) Send(ctx context.Context, points []model.MetricPoint) error {
	return h.client.SendMetrics(ctx, points)
}

func (h *httpSender) Close() {}

type natsSender struct {
	pub *publisher.JetStreamPublisher
}

func (n *natsSender) Send(ctx context.Context, points []model.MetricPoint) error {
	return n.pub.Publish(ctx, points)
}

func (n *natsSender) Close() {
	n.pub.Close()
}

func main() {
	log.Println("[INFO] Starting PulseWatch Collector Agent...")

	// Initialize distributed tracing
	_, err := pwotel.InitTracer("pulsewatch-collector")
	if err != nil {
		log.Printf("[WARN] Failed to initialize tracer (non-fatal): %v", err)
	}
	defer pwotel.Shutdown(context.Background())

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load configuration: %v", err)
	}

	log.Printf("[INFO] Configured collector: id=%s host=%s service=%s interval=%s mode=%s",
		cfg.CollectorID, cfg.Host, cfg.Service, cfg.Interval, cfg.Mode)

	var sender MetricSender

	if cfg.Mode == "http" {
		log.Printf("[INFO] Using HTTP transport targeting %s", cfg.IngestionURL)
		httpClient := client.NewHTTPClient(cfg.IngestionURL, cfg.HTTPTimeout, cfg.RetryBackoff, cfg.MaxRetries)
		sender = &httpSender{client: httpClient}
	} else {
		log.Printf("[INFO] Using NATS JetStream transport connecting to %s (stream: %s)", cfg.NATSURL, cfg.StreamName)
		jsPub, err := publisher.NewJetStreamPublisher(cfg.NATSURL, cfg.StreamName, "metrics.>", cfg.BufferSize)
		if err != nil {
			log.Fatalf("[FATAL] Failed to initialize NATS publisher: %v", err)
		}
		sender = &natsSender{pub: jsPub}
	}
	defer sender.Close()

	collector := metrics.NewSystemCollector(cfg.Host, cfg.Service, cfg.CollectorID)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	// Initial collection
	collectAndSend(ctx, collector, sender)

	log.Printf("[INFO] Collector agent running on %s ticker (%s mode). Press Ctrl+C to terminate.", cfg.Interval, cfg.Mode)

	for {
		select {
		case <-ticker.C:
			collectAndSend(ctx, collector, sender)

		case sig := <-sigChan:
			log.Printf("[INFO] Received signal %s. Shutting down collector gracefully...", sig)
			sender.Close()
			log.Println("[INFO] Collector agent stopped cleanly.")
			return
		}
	}
}

func collectAndSend(ctx context.Context, c *metrics.SystemCollector, s MetricSender) {
	tracer := pwotel.Tracer("pulsewatch.collector")
	ctx, span := tracer.Start(ctx, "collect_and_send")
	defer span.End()

	start := time.Now()
	points, err := c.Collect(ctx)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		log.Printf("[WARN] Error collecting system metrics: %v", err)
		return
	}

	span.SetAttributes(attribute.Int("metrics.count", len(points)))

	err = s.Send(ctx, points)
	if err != nil {
		span.SetAttributes(attribute.String("send.error", err.Error()))
		log.Printf("[WARN] Metric delivery notice: %v", err)
		return
	}

	log.Printf("[INFO] Successfully delivered %d metric points (took %s)", len(points), time.Since(start).Round(time.Millisecond))
}
