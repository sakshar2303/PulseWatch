package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sakshar2303/pulsewatch/ingestion/internal/batcher"
	"github.com/sakshar2303/pulsewatch/ingestion/internal/config"
	"github.com/sakshar2303/pulsewatch/ingestion/internal/consumer"
	"github.com/sakshar2303/pulsewatch/ingestion/internal/handler"
	"github.com/sakshar2303/pulsewatch/ingestion/internal/writer"
	pwotel "github.com/sakshar2303/pulsewatch/pkg/otel"
)

func main() {
	log.Println("[INFO] Starting PulseWatch Ingestion Service...")

	// Initialize distributed tracing
	_, err := pwotel.InitTracer("pulsewatch-ingestion")
	if err != nil {
		log.Printf("[WARN] Failed to initialize tracer (non-fatal): %v", err)
	}
	defer pwotel.Shutdown(context.Background())

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load configuration: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize database writer
	log.Printf("[INFO] Connecting to TimescaleDB at %s...", cfg.DatabaseURL)
	tsWriter, err := writer.NewTimescaleWriter(ctx, cfg.DatabaseURL, cfg.DBMaxConns, cfg.DBMinConns)
	if err != nil {
		log.Fatalf("[FATAL] Failed to connect to TimescaleDB: %v", err)
	}
	defer tsWriter.Close()
	log.Println("[INFO] Connected to TimescaleDB successfully.")

	// Initialize in-memory batch accumulator for HTTP endpoints
	metricBatcher := batcher.New(tsWriter, cfg.BatchSize, cfg.BatchTimeout, 10000)
	defer metricBatcher.Stop()

	// Initialize NATS JetStream pull consumer if enabled
	var jsConsumer *consumer.JetStreamConsumer
	if cfg.EnableNATS {
		log.Printf("[INFO] Initializing JetStream consumer from %s (stream: %s, consumer: %s)...",
			cfg.NATSURL, cfg.StreamName, cfg.ConsumerName)
		jsConsumer, err = consumer.NewJetStreamConsumer(
			cfg.NATSURL,
			cfg.StreamName,
			cfg.ConsumerName,
			"metrics.>",
			tsWriter,
			cfg.ConsumerBatchSize,
			cfg.ConsumerFetchTimeout,
		)
		if err != nil {
			log.Fatalf("[FATAL] Failed to initialize JetStream consumer: %v", err)
		}
		defer jsConsumer.Stop()
		jsConsumer.Start(ctx)
	}

	// Set up HTTP multiplexer
	mux := http.NewServeMux()
	metricsHandler := handler.NewMetricsHandler(metricBatcher, cfg.MaxBodyBytes)
	healthHandler := handler.NewHealthHandler(tsWriter, metricBatcher)

	mux.HandleFunc("POST /api/v1/metrics", metricsHandler.HandleIngest)
	mux.HandleFunc("GET /health", healthHandler.HandleHealth)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Capture OS signals for graceful termination
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[INFO] Ingestion HTTP server listening on port %s...", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[FATAL] Ingestion server crashed: %v", err)
		}
	}()

	sig := <-sigChan
	log.Printf("[INFO] Received signal %s. Initiating graceful shutdown...", sig)

	// Stop JetStream consumer first to cease pulling new queue messages
	if jsConsumer != nil {
		log.Println("[INFO] Stopping JetStream consumer and completing active batch...")
		jsConsumer.Stop()
	}

	// Shutdown HTTP server next to reject new incoming HTTP requests
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[ERROR] Ingestion server shutdown error: %v", err)
	}

	// Drain and flush pending points in the HTTP batcher
	log.Println("[INFO] Draining batcher queue and flushing in-flight metrics...")
	metricBatcher.Stop()

	log.Println("[INFO] Ingestion service stopped cleanly.")
}
