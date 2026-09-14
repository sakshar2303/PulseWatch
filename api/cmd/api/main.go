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

	"github.com/sakshar2303/pulsewatch/api/internal/config"
	"github.com/sakshar2303/pulsewatch/api/internal/handler"
	"github.com/sakshar2303/pulsewatch/api/internal/middleware"
	"github.com/sakshar2303/pulsewatch/api/internal/store"
	"github.com/sakshar2303/pulsewatch/api/internal/websocket"
)

func main() {
	log.Println("[INFO] Starting PulseWatch Query/API Service...")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Failed to load configuration: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize database store
	log.Printf("[INFO] Connecting to TimescaleDB at %s...", cfg.DatabaseURL)
	dbStore, err := store.NewPgxStore(ctx, cfg.DatabaseURL, cfg.DBMaxConns, cfg.DBMinConns)
	if err != nil {
		log.Fatalf("[FATAL] Failed to connect to TimescaleDB: %v", err)
	}
	defer dbStore.Close()
	log.Println("[INFO] Connected to TimescaleDB successfully.")

	// Initialize WebSocket hub for live streaming
	wsHub := websocket.NewHub(cfg.NATSURL)
	go wsHub.Run()
	defer wsHub.Close()

	// Set up router
	mux := http.NewServeMux()
	queryHandler := handler.NewQueryHandler(dbStore)
	namesHandler := handler.NewNamesHandler(dbStore)
	healthHandler := handler.NewHealthHandler(dbStore)
	servicesHandler := handler.NewServicesHandler(dbStore)
	hostsHandler := handler.NewHostsHandler(dbStore)
	anomaliesHandler := handler.NewAnomaliesHandler(dbStore)
	wsHandler := websocket.NewHandler(wsHub)

	mux.HandleFunc("GET /health", healthHandler.HandleHealth)
	mux.HandleFunc("GET /api/v1/metrics/names", namesHandler.HandleNames)
	mux.HandleFunc("GET /api/v1/metrics/query", queryHandler.HandleQuery)
	mux.HandleFunc("GET /api/v1/services", servicesHandler.HandleServices)
	mux.HandleFunc("GET /api/v1/hosts", hostsHandler.HandleHosts)
	mux.HandleFunc("GET /api/v1/anomalies", anomaliesHandler.HandleList)
	mux.HandleFunc("PATCH /api/v1/anomalies/{id}/resolve", anomaliesHandler.HandleResolve)
	mux.HandleFunc("POST /api/v1/anomalies/{id}/resolve", anomaliesHandler.HandleResolve)
	mux.HandleFunc("GET /ws/live", wsHandler.ServeWS)

	// Wrap router with CORS middleware
	corsMiddleware := middleware.CORS(cfg.CORSOrigins)
	httpHandler := corsMiddleware(mux)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      httpHandler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[INFO] Query/API service listening on port %s...", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[FATAL] API server crashed: %v", err)
		}
	}()

	sig := <-sigChan
	log.Printf("[INFO] Received signal %s. Shutting down API service gracefully...", sig)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[ERROR] API server shutdown error: %v", err)
	}

	log.Println("[INFO] Query/API service stopped cleanly.")
}
