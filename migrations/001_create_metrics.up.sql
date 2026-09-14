-- ==============================================================================
-- Migration 001: Create metrics hypertable
-- ==============================================================================
-- This is the core table for all time-series metric data. It stores every
-- data point collected by every collector agent across all hosts and services.
--
-- Design decisions:
--   - JSONB `tags` instead of a normalized label table: avoids JOINs on every
--     query, trades slightly higher per-row storage for dramatically simpler
--     and faster queries. GIN index supports containment queries.
--   - UNIQUE(time, metric_name, host) enables INSERT ... ON CONFLICT DO NOTHING
--     for idempotent ingestion after collector retries.
--   - 7-day chunk interval balances chunk count vs. chunk size for moderate
--     write volumes (< 100k points/sec).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS metrics (
    time        TIMESTAMPTZ      NOT NULL,
    metric_name TEXT             NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    host        TEXT             NOT NULL,
    service     TEXT             NOT NULL,
    tags        JSONB            DEFAULT '{}',
    UNIQUE (time, metric_name, host)
);

-- Convert to a TimescaleDB hypertable partitioned by time.
-- chunk_time_interval: 7 days keeps each chunk manageable for moderate write volume.
-- if_not_exists: makes this migration idempotent.
SELECT create_hypertable('metrics', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Index: filter by service, then scan time descending (dashboard "show me service X" queries)
CREATE INDEX IF NOT EXISTS idx_metrics_service_time
    ON metrics (service, time DESC);

-- Index: filter by host, then scan time descending (drill-down into a specific host)
CREATE INDEX IF NOT EXISTS idx_metrics_host_time
    ON metrics (host, time DESC);

-- Index: filter by metric name, then scan time descending (e.g., "show all cpu_usage_percent")
CREATE INDEX IF NOT EXISTS idx_metrics_name_time
    ON metrics (metric_name, time DESC);

-- Index: GIN index on tags for containment queries (e.g., tags @> '{"env": "prod"}')
CREATE INDEX IF NOT EXISTS idx_metrics_tags
    ON metrics USING GIN (tags);
