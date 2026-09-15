-- Create forecasts table to store time-series predictions
CREATE TABLE IF NOT EXISTS forecasts (
    id             BIGSERIAL,
    generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metric_name    TEXT        NOT NULL,
    host           TEXT        NOT NULL,
    service        TEXT        NOT NULL,
    forecast_time  TIMESTAMPTZ NOT NULL,
    predicted_value DOUBLE PRECISION NOT NULL,
    lower_bound    DOUBLE PRECISION,   -- 80% confidence interval lower
    upper_bound    DOUBLE PRECISION,   -- 80% confidence interval upper
    horizon_minutes INT         NOT NULL,
    model_type     TEXT        NOT NULL DEFAULT 'holt_winters',
    PRIMARY KEY (id, forecast_time)
);

-- Index for efficient time-series lookups
CREATE INDEX IF NOT EXISTS idx_forecasts_metric_host_service
    ON forecasts (metric_name, host, service, generated_at DESC);

-- Hypertable for time-series performance
SELECT create_hypertable('forecasts', 'forecast_time', if_not_exists => TRUE);
