# PulseWatch Detector Service

The **PulseWatch Detector** is a dual-engine anomaly detection and alerting service built with **Python 3.11+**, **FastAPI**, **scikit-learn**, and **asyncpg**. It operates continuously alongside the Go Ingestion and Query APIs, reading time-series data from TimescaleDB and writing detected anomalies to the `anomalies` table.

---

## Architecture & Detection Engines

```
┌─────────────────────────────────────────────────────────────┐
│                  PulseWatch Detector                        │
│                                                             │
│  ┌──────────────────────────┐  ┌─────────────────────────┐  │
│  │   Threshold Rule Engine  │  │  Isolation Forest ML    │  │
│  │   (PostgreSQL Interval   │  │  (scikit-learn rolling  │  │
│  │    Duration Persistence) │  │   feature engineering)  │  │
│  └─────────────┬────────────┘  └────────────┬────────────┘  │
│                │                            │               │
│                └────────────┬───────────────┘               │
│                             ▼                               │
│                ┌─────────────────────────┐                  │
│                │   Anomaly Deduplicator  │                  │
│                │   (In-Memory Cooldown)  │                  │
│                └────────────┬────────────┘                  │
│                             ▼                               │
│                ┌─────────────────────────┐                  │
│                │ TimescaleDB `anomalies` │                  │
│                └─────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 1. Threshold Rule Evaluator (`app/engine/rules.py`)
- Evaluates user-defined rules stored in the `alert_rules` table.
- Supports operators: `>`, `<`, `>=`, `<=`, `==`.
- **Duration persistence**: Verifies that *all* data points within the rule's configured duration (e.g. `5 minutes`) breach the threshold, eliminating single-spike false alarms.
- Per-host and per-service grouping.

### 2. ML Anomaly Detection Engine (`app/engine/detector.py` & `app/models/isolation_forest.py`)
- Automatically discovers all active metric time series.
- **Rolling feature engineering**: Extracts 4 features per sample:
  1. Raw metric value
  2. Rolling mean (window = 10)
  3. Rolling standard deviation (window = 10)
  4. Delta from previous sample ($\Delta = x_t - x_{t-1}$)
- **Isolation Forest Model**: Fits per-metric models using `sklearn.ensemble.IsolationForest`.
- **Decision Function Scoring**: Inliers produce $> 0$; outliers produce $< 0$.
  - Score $\le -0.15 \rightarrow$ `critical` severity.
  - Score $\le 0.0 \rightarrow$ `warning` severity.
  - Score $> 0.0 \rightarrow$ `info` (non-anomalous).
- Executed via `asyncio.to_thread` to maintain zero event-loop latency.

### 3. Anomaly Deduplicator (`app/engine/deduplicator.py`)
- In-memory cooldown manager keyed by `(metric_name, host, service, type)`.
- Prevents database flooding during persistent anomalous states (default cooldown: 300 seconds).

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check & count of trained models |
| `POST` | `/api/v1/detect` | Ad-hoc ML scoring for on-demand inspection |
| `POST` | `/api/v1/train` | Trigger immediate model training for a metric |
| `GET` | `/api/v1/models` | List all registered models with sample counts |
| `GET` | `/api/v1/anomalies` | Paginated list of recent anomalies |
| `GET` | `/api/v1/rules` | Read-only list of active alert rules |

---

## Running Locally

```bash
# Set up Python venv & dependencies
cd detector
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt

# Run test suite (41 unit & integration tests)
python -m pytest tests/ -v

# Start service on port 8000
uvicorn app.api.main:app --host 0.0.0.0 --port 8000
```
