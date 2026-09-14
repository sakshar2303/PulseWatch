-- ==============================================================================
-- Migration 003: Create alert_rules table
-- ==============================================================================
-- Stores user-defined alerting rules. Each rule specifies a metric, a condition,
-- a threshold, and how long the condition must persist before firing.
--
-- This table is created now (Phase 0) even though alerting is Phase 4 because
-- the schema is stable and having it ready avoids a migration mid-feature.
--
-- Design decisions:
--   - `condition` is a text field with application-level validation rather than
--     a CHECK constraint, because future conditions (e.g., 'rate_of_change',
--     'absent') are easier to add without a migration.
--   - `service` and `host` are nullable — NULL means "apply to all."
--   - `duration` uses PostgreSQL INTERVAL type for natural expression of
--     "must persist for X minutes before firing."
-- ==============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
    id          BIGSERIAL        PRIMARY KEY,
    name        TEXT             NOT NULL,
    metric_name TEXT             NOT NULL,
    condition   TEXT             NOT NULL,
    threshold   DOUBLE PRECISION NOT NULL,
    duration    INTERVAL         NOT NULL DEFAULT INTERVAL '5 minutes',
    severity    TEXT             NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    service     TEXT,
    host        TEXT,
    enabled     BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Index: list enabled rules (the alerting engine queries this frequently)
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled
    ON alert_rules (enabled, metric_name)
    WHERE enabled = TRUE;
