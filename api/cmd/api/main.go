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
	pwotel "github.com/sakshar2303/pulsewatch/pkg/otel"
)

func main() {
	log.Println("[INFO] Starting PulseWatch Query/API Service...")

	// Initialize distributed tracing
	_, err := pwotel.InitTracer("pulsewatch-api")
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
	alertsHandler := handler.NewAlertsHandler(dbStore)
	forecastHandler := handler.NewForecastHandler(dbStore)
	wsHandler := websocket.NewHandler(wsHub)
	nlQueryHandler := handler.NewNLQueryHandler(cfg.AnthropicAPIKey)

	// Pre-load metric names for AI schema context (best-effort)
	if metricNames, err := dbStore.GetMetricNames(ctx); err == nil {
		nlQueryHandler.SetMetricNames(metricNames)
		log.Printf("[INFO] AI NL Query handler initialized with %d known metrics.", len(metricNames))
	} else {
		log.Printf("[WARN] Could not pre-load metric names for NL Query: %v", err)
	}

	// SLI/SLO metrics (5-minute rolling window)
	sliCollector := middleware.NewSLICollector(5 * time.Minute)
	sloHandler := handler.NewSLOHandler(sliCollector)

	mux.HandleFunc("GET /health", healthHandler.HandleHealth)
	mux.HandleFunc("GET /api/v1/metrics/names", namesHandler.HandleNames)
	mux.HandleFunc("GET /api/v1/metrics/query", queryHandler.HandleQuery)
	mux.HandleFunc("GET /api/v1/services", servicesHandler.HandleServices)
	mux.HandleFunc("GET /api/v1/hosts", hostsHandler.HandleHosts)
	mux.HandleFunc("GET /api/v1/anomalies", anomaliesHandler.HandleList)
	mux.HandleFunc("PATCH /api/v1/anomalies/{id}/resolve", anomaliesHandler.HandleResolve)
	mux.HandleFunc("POST /api/v1/anomalies/{id}/resolve", anomaliesHandler.HandleResolve)
	mux.HandleFunc("GET /api/v1/alerts/rules", alertsHandler.HandleList)
	mux.HandleFunc("POST /api/v1/alerts/rules", alertsHandler.HandleCreate)
	mux.HandleFunc("GET /api/v1/alerts/rules/{id}", alertsHandler.HandleGet)
	mux.HandleFunc("PUT /api/v1/alerts/rules/{id}", alertsHandler.HandleUpdate)
	mux.HandleFunc("DELETE /api/v1/alerts/rules/{id}", alertsHandler.HandleDelete)
	mux.HandleFunc("PATCH /api/v1/alerts/rules/{id}/toggle", alertsHandler.HandleToggle)
	mux.HandleFunc("POST /api/v1/alerts/rules/{id}/toggle", alertsHandler.HandleToggle)
	mux.HandleFunc("GET /ws/live", wsHandler.ServeWS)
	mux.HandleFunc("GET /api/v1/slo", sloHandler.HandleSLO)
	mux.HandleFunc("GET /api/v1/forecasts", forecastHandler.HandleForecasts)
	mux.HandleFunc("POST /api/v1/ai/nl-query", nlQueryHandler.HandleNLQuery)

	// Wrap router with middleware chain: tracing → SLI → CORS → handler
	tracingMiddleware := middleware.Tracing()
	sliMiddleware := middleware.SLI(sliCollector)
	corsMiddleware := middleware.CORS(cfg.CORSOrigins)
	httpHandler := tracingMiddleware(sliMiddleware(corsMiddleware(mux)))

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
