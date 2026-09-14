# PulseWatch — System Architecture

## Overview

PulseWatch is a self-hosted observability platform with five core services communicating through a message queue and a shared time-series database.

## Component Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Collector Agent │     │  Collector Agent │     │  Collector Agent │
│  (Go, per-host)  │     │  (Go, per-host)  │     │  (Go, per-host)  │
│                  │     │                  │     │                  │
│  Collects:       │     │  Collects:       │     │  Collects:       │
│  - CPU usage     │     │  - CPU usage     │     │  - CPU usage     │
│  - Memory        │     │  - Memory        │     │  - Memory        │
│  - Disk I/O      │     │  - Disk I/O      │     │  - Disk I/O      │
│  - Network I/O   │     │  - Network I/O   │     │  - Network I/O   │
│  - Load average  │     │  - Load average  │     │  - Load average  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  NATS Publish         │                       │
         │  Subject: metrics.>   │                       │
         └───────────┬───────────┘───────────────────────┘
                     │
                     ▼
         ┌───────────────────────────────────────────────┐
         │              NATS JetStream                    │
         │                                                │
         │  Stream:     METRICS                           │
         │  Subjects:   metrics.>                         │
         │  Storage:    File-backed                       │
         │  Retention:  Limits (1h / 1GB / 10M msgs)     │
         │  Discard:    Old (drop oldest when full)       │
         │                                                │
         │  ┌────────────────────────────────────┐        │
         │  │  Consumer: ingestion-worker         │        │
         │  │  Mode:     Pull-based               │        │
         │  │  Ack:      Explicit                 │        │
         │  │  Max Redeliver: 5                   │        │
         │  └────────────────────────────────────┘        │
         └───────────────────┬───────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────────────────┐
         │           Ingestion Service (Go)               │
         │                                                │
         │  1. Pull messages from JetStream consumer      │
         │  2. Validate metric point schema               │
         │  3. Accumulate into batch (500 pts / 1s max)   │
         │  4. Batch INSERT ... ON CONFLICT DO NOTHING    │
         │  5. Ack messages on successful write           │
         │                                                │
         │  Exposes: /health, /metrics (Prometheus)       │
         └───────────────────┬───────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────────────────┐
         │              TimescaleDB                       │
         │           (PostgreSQL 16 + extension)          │
         │                                                │
         │  Tables:                                       │
         │  ┌──────────────────────────────┐              │
         │  │  metrics (hypertable)         │              │
         │  │  - time, metric_name, value   │              │
         │  │  - host, service, tags        │              │
         │  │  - 7-day chunk interval       │              │
         │  └──────────────────────────────┘              │
         │  ┌──────────────────────────────┐              │
         │  │  anomalies                    │              │
         │  │  - severity, type, score      │              │
         │  │  - resolved_at (nullable)     │              │
         │  └──────────────────────────────┘              │
         │  ┌──────────────────────────────┐              │
         │  │  alert_rules                  │              │
         │  │  - condition, threshold       │              │
         │  │  - duration, enabled          │              │
         │  └──────────────────────────────┘              │
         └───────────┬─────────────────┬─────────────────┘
                     │                 │
          ┌──────────┘                 └──────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────────┐             ┌─────────────────────────┐
│  Query/API Service  │             │  Anomaly Detection       │
│  (Go)               │             │  Service (Python)        │
│                     │             │                          │
│  REST Endpoints:    │             │  - FastAPI               │
│  - GET /metrics/*   │             │  - Isolation Forest      │
│  - GET /anomalies/* │  ◄──────── │  - Scheduled: every 5min │
│  - CRUD /alerts/*   │  anomalies │    query last 30min data │
│  - GET /services    │  written   │    detect anomalies      │
│  - GET /hosts       │  to DB     │    write to anomalies    │
│  - GET /health      │             │    table                 │
│                     │             │  - POST /detect (ad-hoc) │
│  WebSocket:         │             │  - POST /train           │
│  - /ws/live         │             │  - GET /health           │
│    (subscribe to    │             │                          │
│     live metrics)   │             │  DB: Direct connection   │
└────────┬────────────┘             └──────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Frontend Dashboard                  │
│  (React + TypeScript + Vite)         │
│                                      │
│  Live View:     WebSocket → charts   │
│  Historical:    REST API → charts    │
│  Anomalies:     REST API → alerts    │
│  Service Health: REST API → grid     │
│                                      │
│  Stack: Recharts, Tailwind CSS       │
│  Theme: Dark mode, mission-control   │
└──────────────────────────────────────┘
```

## Data Flow

### Happy Path (metric collection → dashboard)

1. Collector agent reads system metrics (CPU, memory, disk, network) every 10 seconds.
2. Each metric point is published to NATS subject `metrics.<metric_type>` (e.g., `metrics.cpu`).
3. NATS JetStream persists the message to disk.
4. Ingestion service pulls a batch of messages from JetStream.
5. Messages are validated and accumulated until batch is full (500 points) or timeout (1 second).
6. Batch is written to TimescaleDB via `INSERT ... ON CONFLICT DO NOTHING`.
7. On successful write, messages are acknowledged to JetStream.
8. Query/API service reads from TimescaleDB and serves REST queries + WebSocket live streams.
9. Dashboard displays real-time and historical data.

### Failure Modes

| Failure | Behavior | Recovery |
|---|---|---|
| NATS down | Collectors buffer locally (disk-backed ring buffer). Buffer drains when NATS recovers. | Automatic |
| Ingestion service down | Messages accumulate in JetStream (up to retention limits). No data loss for short outages. | Automatic on restart |
| TimescaleDB down | Ingestion service retries writes with exponential backoff. Messages remain in JetStream. | Automatic when DB recovers |
| Ingestion can't keep up | JetStream DiscardOld drops oldest messages. Recent data prioritized. | Scale ingestion horizontally |
| Collector crash | Only that host's metrics stop. Other collectors unaffected. | Restart collector |
| Network partition | Collectors buffer locally. Pipeline resumes when connectivity returns. | Automatic |

### Backpressure Strategy

Three lines of defense, in order:

1. **JetStream buffer**: 1GB / 10M messages / 1 hour — absorbs burst traffic.
2. **DiscardOld policy**: When buffer is full, oldest messages are dropped. Recent data is more valuable than old data in observability.
3. **Batch processing**: Ingestion processes in configurable batches. Under sustained overload, it lags but doesn't crash.

**Documented tradeoff**: Under extreme, sustained overload, old metric data is lost. This is an acceptable trade-off for an observability system where recency matters most. We surface a "messages dropped" metric to make data loss visible.

## Security Considerations (Phase 4+)

- API authentication via JWT tokens
- Rate limiting on ingestion endpoint (per-collector)
- CORS whitelist for dashboard origin
- No credentials in source code (`.env` + `.gitignore`)
- TLS for NATS connections in production
- Database connection pooling with limited max connections
