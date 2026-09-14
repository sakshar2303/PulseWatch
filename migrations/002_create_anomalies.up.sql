-- ==============================================================================
-- Migration 002: Create anomalies table
-- ==============================================================================
-- Stores detected anomalies from both threshold-based rules and ML models.
-- Written to by the anomaly detection service, read by the Query/API service
-- and surfaced in the dashboard.
--
-- Design decisions:
--   - `severity` is constrained to a known enum set via CHECK constraint
--     rather than a Postgres ENUM type, because ENUM types are painful to
--     alter later and CHECK constraints are functionally equivalent.
--   - `resolved_at` is NULL until explicitly resolved — the partial index
--     on unresolved anomalies makes "show active alerts" queries fast.
--   - `score` and `threshold` are nullable because not all detection types
--     produce both (threshold-based has threshold but no score; ML has score
--     but no threshold).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS anomalies (
    id          BIGSERIAL        PRIMARY KEY,
    detected_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    metric_name TEXT             NOT NULL,
    host        TEXT             NOT NULL,
    service     TEXT             NOT NULL,
    severity    TEXT             NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    type        TEXT             NOT NULL,
    description TEXT             NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    threshold   DOUBLE PRECISION,
    score       DOUBLE PRECISION,
    resolved_at TIMESTAMPTZ,
    metadata    JSONB            DEFAULT '{}'
);

-- Index: list anomalies by time (dashboard "recent anomalies" view)
CREATE INDEX IF NOT EXISTS idx_anomalies_time
    ON anomalies (detected_at DESC);

-- Index: filter by service + time (drill-down into a specific service's anomalies)
CREATE INDEX IF NOT EXISTS idx_anomalies_service
    ON anomalies (service, detected_at DESC);

-- Partial index: only unresolved anomalies, filtered by severity
-- This makes the "active alerts" dashboard panel fast even with millions of historical rows.
CREATE INDEX IF NOT EXISTS idx_anomalies_active_severity
    ON anomalies (severity, detected_at DESC)
    WHERE resolved_at IS NULL;
