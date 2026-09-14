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
- [ ] **Phase 1** — Core Pipeline: Collector → NATS → Ingestion → TimescaleDB → Query API
- [ ] **Phase 2** — Scale: Backpressure handling, load testing, multiple collectors
- [ ] **Phase 3** — Dashboard: Live mission-control UI with real-time charts
- [ ] **Phase 4** — Alerting + ML: Threshold alerts, Isolation Forest anomaly detection
- [ ] **Phase 5** — Infra: Docker, Kubernetes, CI/CD, Terraform
- [ ] **Phase 6** — Polish: Distributed tracing, chaos testing, SLOs, live demo

---

## Load Test Results

> TODO: Phase 2 — will document events/sec, latency percentiles, and failure modes under load.

---

## License

[MIT](LICENSE)
