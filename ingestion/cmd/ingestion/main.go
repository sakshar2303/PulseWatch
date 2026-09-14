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
	"github.com/sakshar2303/pulsewatch/ingestion/internal/handler"
	"github.com/sakshar2303/pulsewatch/ingestion/internal/writer"
)

func main() {
	log.Println("[INFO] Starting PulseWatch Ingestion Service...")

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

	// Initialize in-memory batch accumulator
	metricBatcher := batcher.New(tsWriter, cfg.BatchSize, cfg.BatchTimeout, 10000)
	defer metricBatcher.Stop()

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
		log.Printf("[INFO] Ingestion service listening on port %s...", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[FATAL] Ingestion server crashed: %v", err)
		}
	}()

	sig := <-sigChan
	log.Printf("[INFO] Received signal %s. Initiating graceful shutdown...", sig)

	// Shutdown HTTP server first to reject new requests
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[ERROR] Ingestion server shutdown error: %v", err)
	}

	// Drain and flush pending points in the batcher
	log.Println("[INFO] Draining batcher queue and flushing in-flight metrics...")
	metricBatcher.Stop()

	log.Println("[INFO] Ingestion service stopped cleanly.")
}
