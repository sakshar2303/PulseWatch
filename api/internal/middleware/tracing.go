package middleware

import (
	"fmt"
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

const tracerName = "pulsewatch.api.http"

// statusWriter wraps http.ResponseWriter to capture the status code.
type statusWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

func (sw *statusWriter) WriteHeader(code int) {
	if !sw.written {
		sw.statusCode = code
		sw.written = true
	}
	sw.ResponseWriter.WriteHeader(code)
}

func (sw *statusWriter) Write(b []byte) (int, error) {
	if !sw.written {
		sw.statusCode = http.StatusOK
		sw.written = true
	}
	return sw.ResponseWriter.Write(b)
}

// Tracing returns HTTP middleware that wraps every incoming request in an
// OpenTelemetry span. It:
//   - Extracts incoming trace context from W3C traceparent headers
//   - Creates a server span for the request lifecycle
//   - Records http.method, http.url, http.status_code, http.route as attributes
//   - Propagates the span context to downstream handlers via request context
func Tracing() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		tracer := otel.Tracer(tracerName)
		propagator := otel.GetTextMapPropagator()

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract parent span context from incoming headers
			ctx := propagator.Extract(r.Context(), propagation.HeaderCarrier(r.Header))

			spanName := fmt.Sprintf("%s %s", r.Method, r.URL.Path)
			ctx, span := tracer.Start(ctx, spanName,
				trace.WithSpanKind(trace.SpanKindServer),
				trace.WithAttributes(
					semconv.HTTPRequestMethodKey.String(r.Method),
					semconv.URLFull(r.URL.String()),
					semconv.URLPath(r.URL.Path),
					semconv.ServerAddress(r.Host),
					semconv.UserAgentOriginal(r.UserAgent()),
				),
			)
			defer span.End()

			// Wrap writer to capture status code
			sw := &statusWriter{ResponseWriter: w, statusCode: http.StatusOK}

			// Serve with the traced context
			next.ServeHTTP(sw, r.WithContext(ctx))

			// Record response attributes
			span.SetAttributes(
				semconv.HTTPResponseStatusCode(sw.statusCode),
			)

			if sw.statusCode >= 400 {
				span.SetAttributes(attribute.Bool("error", true))
			}
		})
	}
}
