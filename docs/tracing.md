# PulseWatch — Distributed Tracing Guide

## Overview

PulseWatch uses [OpenTelemetry](https://opentelemetry.io/) for distributed tracing across all services. Traces are collected by [Jaeger](https://www.jaegertracing.io/) and can be explored via the Jaeger UI at **http://localhost:16686**.

---

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Collector   │    │  Ingestion  │    │   API       │    │  Detector   │
│  (Go + OTel) │    │  (Go + OTel)│    │  (Go + OTel)│    │  (Py + OTel)│
└──────┬───────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                   │                   │                  │
       │   OTLP gRPC       │   OTLP gRPC       │   OTLP gRPC     │   OTLP gRPC
       └────────┬──────────┘────────┬──────────┘──────────┬───────┘
                │                   │                      │
                ▼                   ▼                      ▼
        ┌─────────────────────────────────────────────────────────┐
        │              Jaeger All-in-One (port 4317)              │
        │              UI: http://localhost:16686                  │
        └─────────────────────────────────────────────────────────┘
```

---

## Instrumentation Details

### Go Services (Collector, Ingestion, API)

All Go services use a **shared OpenTelemetry tracing package** at `pkg/otel/tracing.go`:

```go
import pwotel "github.com/sakshar2303/pulsewatch/pkg/otel"

// Initialize tracer at service startup
tp, err := pwotel.InitTracer("pulsewatch-api")
defer pwotel.Shutdown(ctx)
```

**Exporter selection** is automatic:
- If `OTEL_EXPORTER_OTLP_ENDPOINT` is set → OTLP gRPC exporter (production/Docker)
- If unset → stdout exporter (local development)

### API Service — HTTP Tracing Middleware

The API service includes HTTP middleware (`api/internal/middleware/tracing.go`) that:

1. **Extracts** incoming trace context from W3C `traceparent` headers
2. **Creates** a server span for each request lifecycle
3. **Records** span attributes:
   - `http.request.method`
   - `url.full`, `url.path`
   - `http.response.status_code`
   - `server.address`
   - `user_agent.original`
4. **Propagates** trace context to downstream handlers

### Collector Agent — Collection Spans

The collector wraps each `collectAndSend` cycle in a span with:
- `metrics.count`: number of metric points collected
- `error` / `send.error`: error details if collection or delivery fails

### Python Detector — FastAPI Auto-Instrumentation

The detector uses OpenTelemetry Python SDK with FastAPI auto-instrumentation:

```python
from app.tracing import setup_tracing, instrument_app

setup_tracing("pulsewatch-detector")
instrument_app(app)  # Auto-instruments all FastAPI routes
```

---

## Trace Propagation Flow

A typical end-to-end trace through PulseWatch:

```
1. Collector collects host metrics
   └── Span: collect_and_send (collector)
       ├── attribute: metrics.count = 6
       └── Publishes to NATS JetStream

2. Ingestion pulls from JetStream
   └── Span: process_batch (ingestion)
       └── Batch INSERT into TimescaleDB

3. Dashboard requests data via API
   └── Span: GET /api/v1/metrics/query (api)
       ├── attribute: http.request.method = GET
       ├── attribute: http.response.status_code = 200
       └── Queries TimescaleDB

4. Detector evaluates anomalies
   └── Span: POST /api/v1/detect (detector)
       └── Runs Isolation Forest model
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Jaeger OTLP gRPC endpoint | _(stdout if unset)_ |

### Docker Compose

In `docker-compose.prod.yml`, all services are configured with:

```yaml
environment:
  OTEL_EXPORTER_OTLP_ENDPOINT: "jaeger:4317"
```

The Jaeger all-in-one container runs alongside the application stack.

---

## Using the Jaeger UI

### 1. Start the stack

```bash
docker compose up -d                   # dev (with Jaeger)
# or
make docker-prod-up                    # production stack
```

### 2. Open Jaeger UI

Navigate to **http://localhost:16686**

### 3. Explore Traces

1. **Select a service** from the "Service" dropdown (e.g., `pulsewatch-api`)
2. **Click "Find Traces"** to see recent traces
3. **Click a trace** to see the full span waterfall view
4. **Inspect span details** for timing, attributes, and errors

### 4. Service Dependency Graph

Click **"System Architecture"** → **"DAG"** in the Jaeger UI to see the automatically generated service dependency graph showing how services communicate.

---

## Local Development

When running services locally (without Docker), traces are written to stdout by default. To send traces to a local Jaeger instance:

```bash
# Start just Jaeger
docker compose up -d jaeger

# Set the endpoint for local services
export OTEL_EXPORTER_OTLP_ENDPOINT=localhost:4317

# Run services normally
make run-api
make run-collector
```
