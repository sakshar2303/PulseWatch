# PulseWatch

**Self-hosted, real-time observability and anomaly detection platform.**

A lightweight alternative to Datadog/Grafana/New Relic that collects metrics from distributed services, stores them efficiently in TimescaleDB, detects anomalies via machine learning, and visualizes system health through a live mission-control dashboard.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Collector Agent │     │  Collector Agent │     │  Collector Agent │
│  (Go, per-host)  │     │  (Go, per-host)  │     │  (Go, per-host)  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  NATS publish         │                       │
         └───────────┬───────────┘───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   NATS JetStream      │
         │   (message queue)     │
         └───────────┬───────────┘
                     │
                     ▼  (pull-based consumer)
         ┌───────────────────────┐
         │   Ingestion Service   │
         │   (Go — batch writer) │
         └───────────┬───────────┘
                     │
                     ▼  (batch INSERT)
         ┌───────────────────────┐
         │   TimescaleDB         │
         │   (time-series store) │
         └───────────┬───────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
┌─────────────────┐   ┌─────────────────────┐
│  Query/API      │   │  Anomaly Detection  │
│  Service (Go)   │◄──│  Service (Python +  │
│  REST + WS      │   │  scikit-learn)      │
└────────┬────────┘   └─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Dashboard (React)  │
│  Live + Historical  │
└─────────────────────┘
```

### Why This Stack

Go end-to-end for the core pipeline keeps velocity high for a solo build while staying squarely in the cloud-native ecosystem employers hire for. TimescaleDB trades a small amount of "impressive tech name" for real SQL fluency and faster debugging. NATS JetStream gives a legitimate message-queue story with far less operational overhead than Kafka for a single engineer to run. Python is isolated to the ML service specifically because that's the ecosystem's strength. OpenTelemetry is used throughout because it's the current industry-standard instrumentation layer.

---

## Tech Stack

| Component | Technology |
|---|---|
| Collector Agent | Go |
| Ingestion Service | Go + pgx |
| Message Queue | NATS with JetStream |
| Time-Series Storage | TimescaleDB (PostgreSQL extension) |
| Query/API Layer | Go (net/http) |
| Anomaly Detection | Python + FastAPI + scikit-learn |
| Instrumentation | OpenTelemetry (Go + Python) |
| Frontend | React + TypeScript + Vite |
| Charts | Recharts |
| Styling | Tailwind CSS (custom design tokens) |
| Containerization | Docker + Docker Compose |
| Orchestration | Kubernetes (k3s) |
| CI/CD | GitHub Actions |
| IaC | Terraform |

---

## Project Structure

```
PulseWatch/
├── collector/          # Go — Collector agent (runs per host)
├── ingestion/          # Go — NATS consumer + batch writer to TimescaleDB
├── api/                # Go — Query/API service (REST + WebSocket)
├── detector/           # Python — ML anomaly detection service
├── dashboard/          # React + TS — Live monitoring dashboard
├── migrations/         # SQL schema migrations
├── deployments/        # Kubernetes manifests, Terraform configs
├── scripts/            # Dev tools, load generator, seed data
├── docs/               # Architecture docs, API specs
└── .github/workflows/  # CI/CD pipelines
```

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Go 1.22+
- Python 3.11+
- Node.js 20+

### 1. Start Infrastructure

```bash
# Copy environment template
cp .env.example .env

# Start TimescaleDB and NATS
docker compose up -d
```

### 2. Run Migrations

```bash
make migrate-up
```

### 3. Start Services

```bash
# Terminal 1 — Ingestion service
make run-ingestion

# Terminal 2 — Collector agent
make run-collector

# Terminal 3 — Query/API service
make run-api

# Terminal 4 — Anomaly detection service
make run-detector

# Terminal 5 — Frontend dashboard
make run-dashboard
```

### 4. Open Dashboard

Navigate to [http://localhost:5173](http://localhost:5173)

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Pull-based NATS consumer | Gives ingestion explicit control over consumption rate — natural backpressure without blocking collectors |
| Batch writes to TimescaleDB | Amortizes per-transaction WAL cost; 500 rows or 1s window, whichever comes first |
| Separate ingestion and query services | Different scaling characteristics: write-heavy vs. read-heavy workloads |
| JSONB tags (not normalized label table) | Avoids JOIN on every query; GIN index supports containment queries; simpler at the cost of slightly higher storage |
| Anomaly service polls DB directly | Needs historical windows; polling is simpler and idempotent vs. consuming from queue |
| WebSocket for live dashboard | Bidirectional — frontend can subscribe to specific metric streams without reconnecting |

---

## Data Model

A metric point flowing through the system:

```json
{
  "metric_name": "cpu_usage_percent",
  "value": 73.2,
  "timestamp": "2025-01-15T14:30:00.000Z",
  "host": "web-server-01",
  "service": "api-gateway",
  "tags": {
    "env": "production",
    "region": "us-east-1"
  },
  "collector_id": "collector-web-01",
  "sequence_num": 48291
}
```

---

## Build Phases

- [x] **Phase 0** — Design: Architecture, data model, API contracts, project scaffold
- [x] **Phase 1** — Core Pipeline: Collector → Direct Ingestion → TimescaleDB → Query API
- [x] **Phase 2** — Scale: NATS JetStream queue, backpressure handling, load testing, multiple collectors
- [x] **Phase 3** — Dashboard: Live mission-control UI with real-time charts
- [x] **Phase 4** — Alerting + ML: Threshold alerts, Isolation Forest anomaly detection
- [x] **Phase 5** — Infra: Docker, Kubernetes, CI/CD, Terraform
- [x] **Phase 6** — Polish: Distributed tracing, chaos testing, SLOs, live demo

---

## Observability, SLOs & Distributed Tracing

PulseWatch dogfoods industry-standard observability practices on its own microservices:

- **Distributed Tracing**: OpenTelemetry SDKs instrument all Go services and the Python anomaly detector. Spans are exported via OTLP gRPC to **Jaeger** (`http://localhost:16686`).
- **Trace Propagation**: Context is injected into HTTP request headers (`traceparent`) and async background routines. See [docs/tracing.md](docs/tracing.md) for architecture and tracing workflows.
- **SLO / SLI Tracking**: In-memory rolling-window SLI collector measures API availability (99.9% target) and latency (p99 < 500ms target). Real-time compliance and error budget consumption are queryable via `GET /api/v1/slo`.

---

## Chaos Engineering & Resilience

PulseWatch includes an automated fault injection framework (`scripts/chaos/chaos_test.sh`) to evaluate self-healing and fault tolerance:

| Experiment | Fault Injected | Observed System Behavior | Result |
|---|---|---|---|
| **EXP-01: NATS Outage** | Killed NATS JetStream container | Collectors safely buffered in ring buffers; drained on recovery | **PASSED** |
| **EXP-02: DB Outage** | Stopped TimescaleDB container | Ingestion queued batches in JetStream; committed upon recovery | **PASSED** |
| **EXP-03: Detector Crash** | Terminated Python detector process | API & ingestion pipeline unaffected; zero impact on collection | **PASSED** |
| **EXP-04: Concurrency Load** | 10,000 pts/sec burst over 50 hosts | Zero crash; bounded latency within p99 SLO thresholds | **PASSED** |
| **EXP-05: Network Partition** | Isolated broker network | Collectors resumed queue sync cleanly without split-brain | **PASSED** |

Full chaos experiment methodology and failure domain analysis are documented in [docs/chaos_test_results.md](docs/chaos_test_results.md).

---

## Load Test Results

Full details and latency distributions are documented in [docs/load_test_results.md](docs/load_test_results.md).

### Summary Benchmarks (Synthetic Load Generator)

| Benchmark | Mode | Concurrency | Aggregate Rate | Throughput Handled | Loss Rate | p50 Latency | p99 Latency |
|---|---|---|---|---|---|---|---|
| **Moderate Load** | Direct HTTP | 20 hosts | 2,000 pts/sec | 1,979.61 pts/sec | 0.85% | 1.08 ms | 6.20 ms |
| **Moderate Load** | NATS JetStream | 20 hosts | 2,000 pts/sec | 1,979.64 pts/sec | 1.00% | 11.23 ms | 18.16 ms |
| **High Burst** | Direct HTTP | 50 hosts | 10,000 pts/sec | 9,898.53 pts/sec | 0.90% | 1.85 ms | 6.01 ms |
| **High Burst** | NATS JetStream | 50 hosts | 10,000 pts/sec | 9,898.54 pts/sec | 1.00% | 19.58 ms | 30.02 ms |

---

## License

[MIT](LICENSE)
