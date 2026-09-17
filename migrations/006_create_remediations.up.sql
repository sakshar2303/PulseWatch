-- ==============================================================================
-- Migration 006: Create remediations table
-- ==============================================================================
-- Stores autonomous and operator-initiated remediation actions taken by the
-- AI Auto-Remediation agent to self-heal services and resolve anomalies.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS remediations (
    id              BIGSERIAL        PRIMARY KEY,
    anomaly_id      BIGINT           REFERENCES anomalies(id) ON DELETE SET NULL,
    service         TEXT             NOT NULL,
    host            TEXT             NOT NULL,
    metric_name     TEXT             NOT NULL,
    action_type     TEXT             NOT NULL,
    status          TEXT             NOT NULL CHECK (status IN ('pending', 'analyzing', 'executing', 'success', 'failed')),
    trigger_type    TEXT             NOT NULL CHECK (trigger_type IN ('autonomous', 'manual')),
    llm_plan        TEXT,
    action_payload  JSONB            DEFAULT '{}',
    execution_log   TEXT,
    metric_before   DOUBLE PRECISION,
    metric_after    DOUBLE PRECISION,
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    executed_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

-- Index: list remediations by time (dashboard timeline & audit log)
CREATE INDEX IF NOT EXISTS idx_remediations_time
    ON remediations (created_at DESC);

-- Index: filter by service + time
CREATE INDEX IF NOT EXISTS idx_remediations_service
    ON remediations (service, created_at DESC);

-- Index: filter by status
CREATE INDEX IF NOT EXISTS idx_remediations_status
    ON remediations (status, created_at DESC);

-- Index: lookup by anomaly_id
CREATE INDEX IF NOT EXISTS idx_remediations_anomaly
    ON remediations (anomaly_id);
