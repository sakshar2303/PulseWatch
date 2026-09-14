# PulseWatch — API Reference

## Query/API Service

**Base URL:** `http://localhost:8080/api/v1`

---

### Metrics

#### `GET /metrics/query`

Query metric data points with optional aggregation.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Metric name (e.g., `cpu_usage_percent`) |
| `start` | RFC3339 | ✅ | Start of time range |
| `end` | RFC3339 | ✅ | End of time range |
| `service` | string | ❌ | Filter by service name |
| `host` | string | ❌ | Filter by hostname |
| `step` | string | ❌ | Aggregation interval (e.g., `1m`, `5m`, `1h`) |
| `agg` | string | ❌ | Aggregation function: `avg`, `max`, `min`, `sum`, `count` (default: `avg`) |
| `tags` | JSON | ❌ | Tag filter as JSON object (e.g., `{"env":"prod"}`) |

**Response `200 OK`:**

```json
{
  "metric_name": "cpu_usage_percent",
  "series": [
    {
      "host": "web-server-01",
      "service": "api-gateway",
      "datapoints": [
        {"time": "2025-01-15T14:00:00Z", "value": 72.5},
        {"time": "2025-01-15T14:01:00Z", "value": 74.1}
      ]
    }
  ]
}
```

**Error `400 Bad Request`:**

```json
{
  "error": "missing required parameter: name",
  "code": "INVALID_REQUEST"
}
```

---

#### `GET /metrics/names`

List all distinct metric names in the system.

**Response `200 OK`:**

```json
{
  "names": [
    "cpu_usage_percent",
    "memory_usage_percent",
    "disk_usage_percent",
    "network_rx_bytes_per_sec"
  ]
}
```

---

#### `GET /metrics/labels`

List all distinct tag keys across all metrics.

**Response `200 OK`:**

```json
{
  "labels": ["env", "region", "cpu_core", "mount_point", "interface"]
}
```

---

### Services & Hosts

#### `GET /services`

List all known services with their last-seen timestamp and health status.

**Response `200 OK`:**

```json
{
  "services": [
    {
      "name": "api-gateway",
      "last_seen": "2025-01-15T14:30:00Z",
      "host_count": 3,
      "status": "healthy"
    }
  ]
}
```

---

#### `GET /hosts`

List all known hosts with their last-seen timestamp.

**Response `200 OK`:**

```json
{
  "hosts": [
    {
      "name": "web-server-01",
      "service": "api-gateway",
      "last_seen": "2025-01-15T14:30:00Z",
      "status": "healthy"
    }
  ]
}
```

---

### Anomalies

#### `GET /anomalies`

List detected anomalies with filtering.

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `service` | string | ❌ | Filter by service |
| `severity` | string | ❌ | Filter by severity: `info`, `warning`, `critical` |
| `start` | RFC3339 | ❌ | Start of time range |
| `end` | RFC3339 | ❌ | End of time range |
| `resolved` | boolean | ❌ | Filter by resolved status |
| `limit` | int | ❌ | Max results (default: 50, max: 200) |
| `offset` | int | ❌ | Pagination offset |

**Response `200 OK`:**

```json
{
  "anomalies": [
    {
      "id": 42,
      "detected_at": "2025-01-15T14:25:00Z",
      "metric_name": "cpu_usage_percent",
      "host": "web-server-01",
      "service": "api-gateway",
      "severity": "critical",
      "type": "threshold",
      "description": "CPU usage exceeded 95% for 5 minutes",
      "value": 97.3,
      "threshold": 95.0,
      "score": null,
      "resolved_at": null,
      "metadata": {}
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

#### `GET /anomalies/:id`

Get a single anomaly by ID.

**Response `200 OK`:** Single anomaly object (same structure as list item).

**Response `404 Not Found`:**

```json
{
  "error": "anomaly not found",
  "code": "NOT_FOUND"
}
```

---

#### `PATCH /anomalies/:id/resolve`

Mark an anomaly as resolved.

**Response `200 OK`:**

```json
{
  "id": 42,
  "resolved_at": "2025-01-15T15:00:00Z"
}
```

---

### Alert Rules (Phase 4)

#### `GET /alerts/rules`

List all alert rules.

#### `POST /alerts/rules`

Create a new alert rule.

**Request Body:**

```json
{
  "name": "High CPU Alert",
  "metric_name": "cpu_usage_percent",
  "condition": "gt",
  "threshold": 90.0,
  "duration": "5m",
  "severity": "warning",
  "service": "api-gateway",
  "host": null
}
```

#### `PUT /alerts/rules/:id`

Update an existing alert rule. Same body as POST.

#### `DELETE /alerts/rules/:id`

Delete an alert rule.

---

### System

#### `GET /health`

Health check endpoint returning status of all dependencies.

**Response `200 OK`:**

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime_seconds": 3600,
  "dependencies": {
    "timescaledb": {"status": "healthy", "latency_ms": 2},
    "nats": {"status": "healthy", "latency_ms": 1}
  }
}
```

**Response `503 Service Unavailable`:** Same structure with degraded status.

---

### WebSocket — Live Metrics

#### `WS /ws/live`

Upgrade to WebSocket for real-time metric streaming.

**Client → Server (subscribe):**

```json
{
  "action": "subscribe",
  "metrics": ["cpu_usage_percent", "memory_usage_percent"],
  "services": ["api-gateway"],
  "hosts": []
}
```

**Client → Server (unsubscribe):**

```json
{
  "action": "unsubscribe",
  "metrics": ["memory_usage_percent"]
}
```

**Server → Client (metric data):**

```json
{
  "type": "metric",
  "data": {
    "metric_name": "cpu_usage_percent",
    "value": 73.2,
    "timestamp": "2025-01-15T14:30:00.000Z",
    "host": "web-server-01",
    "service": "api-gateway",
    "tags": {"env": "production"}
  }
}
```

**Server → Client (anomaly alert):**

```json
{
  "type": "anomaly",
  "data": {
    "id": 42,
    "metric_name": "cpu_usage_percent",
    "severity": "critical",
    "description": "CPU usage exceeded 95% for 5 minutes",
    "host": "web-server-01",
    "service": "api-gateway",
    "detected_at": "2025-01-15T14:25:00Z"
  }
}
```

---

## Anomaly Detection Service

**Base URL:** `http://localhost:8000/api/v1`

This is an internal service. Not exposed to the frontend directly.

#### `POST /detect`

Run anomaly detection on a specified metric and time range.

**Request Body:**

```json
{
  "metric_name": "cpu_usage_percent",
  "service": "api-gateway",
  "lookback_minutes": 30
}
```

**Response `200 OK`:**

```json
{
  "anomalies_detected": 2,
  "anomalies": [
    {
      "metric_name": "cpu_usage_percent",
      "host": "web-server-01",
      "timestamp": "2025-01-15T14:25:00Z",
      "value": 97.3,
      "score": -0.85,
      "severity": "critical"
    }
  ]
}
```

#### `POST /train`

Trigger model retraining on historical data.

#### `GET /models`

List trained models and metadata.

#### `GET /health`

Health check.

---

## Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": "human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

| Code | HTTP Status | Description |
|---|---|---|
| `INVALID_REQUEST` | 400 | Missing or invalid parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Dependency down |
