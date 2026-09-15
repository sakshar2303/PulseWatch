// Package otel provides a shared OpenTelemetry tracing initializer for all
// PulseWatch Go services.
//
// Usage:
//
//	tp, err := otel.InitTracer("pulsewatch-api")
//	if err != nil { log.Fatal(err) }
//	defer otel.Shutdown(context.Background())
//
// The exporter target is controlled by the standard OTEL_EXPORTER_OTLP_ENDPOINT
// environment variable. If unset, traces are written to stdout for local
// development.
package otel

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var tp *sdktrace.TracerProvider

// InitTracer creates a TracerProvider for the given service and registers it
// as the global OpenTelemetry provider. It returns the provider so callers
// can defer Shutdown.
//
// If OTEL_EXPORTER_OTLP_ENDPOINT is set (e.g. "jaeger:4317"), traces are
// exported via OTLP/gRPC. Otherwise, a stdout exporter is used.
func InitTracer(serviceName string) (*sdktrace.TracerProvider, error) {
	ctx := context.Background()

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion("1.0.0"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("otel resource: %w", err)
	}

	var exporter sdktrace.SpanExporter

	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint != "" {
		conn, err := grpc.NewClient(endpoint,
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		)
		if err != nil {
			return nil, fmt.Errorf("otel grpc dial %s: %w", endpoint, err)
		}

		exporter, err = otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
		if err != nil {
			return nil, fmt.Errorf("otel otlp exporter: %w", err)
		}
		log.Printf("[OTEL] OTLP exporter configured → %s", endpoint)
	} else {
		exporter, err = stdouttrace.New(stdouttrace.WithPrettyPrint())
		if err != nil {
			return nil, fmt.Errorf("otel stdout exporter: %w", err)
		}
		log.Println("[OTEL] No OTLP endpoint configured — using stdout exporter")
	}

	tp = sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter, sdktrace.WithBatchTimeout(5*time.Second)),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return tp, nil
}

// Shutdown flushes pending spans and shuts down the tracer provider.
func Shutdown(ctx context.Context) {
	if tp == nil {
		return
	}
	shutdownCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := tp.Shutdown(shutdownCtx); err != nil {
		log.Printf("[OTEL] Tracer shutdown error: %v", err)
	}
}

// Tracer returns a named tracer scoped to the given instrumentation library.
func Tracer(name string) trace.Tracer {
	return otel.Tracer(name)
}
