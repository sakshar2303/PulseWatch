-- ==============================================================================
-- PulseWatch — Development Seed Data
-- ==============================================================================
-- Inserts sample metric data for local development and testing.
-- Run with: make seed
--
-- NOTE: This is for development only. The real pipeline generates data via
-- collector agents. Never ship seed data as "real" data.
-- ==============================================================================

-- Insert 1 hour of sample CPU metrics (every 10 seconds) for 2 hosts
INSERT INTO metrics (time, metric_name, value, host, service, tags)
SELECT
    ts,
    'cpu_usage_percent',
    30 + (random() * 50),  -- 30-80% range
    'web-server-0' || (host_num % 2 + 1),
    'api-gateway',
    '{"env": "development", "region": "local"}'::jsonb
FROM
    generate_series(
        NOW() - INTERVAL '1 hour',
        NOW(),
        INTERVAL '10 seconds'
    ) AS ts,
    generate_series(1, 2) AS host_num
ON CONFLICT DO NOTHING;

-- Insert 1 hour of sample memory metrics
INSERT INTO metrics (time, metric_name, value, host, service, tags)
SELECT
    ts,
    'memory_usage_percent',
    50 + (random() * 30),  -- 50-80% range
    'web-server-0' || (host_num % 2 + 1),
    'api-gateway',
    '{"env": "development", "region": "local"}'::jsonb
FROM
    generate_series(
        NOW() - INTERVAL '1 hour',
        NOW(),
        INTERVAL '10 seconds'
    ) AS ts,
    generate_series(1, 2) AS host_num
ON CONFLICT DO NOTHING;

-- Insert a sample anomaly
INSERT INTO anomalies (detected_at, metric_name, host, service, severity, type, description, value, threshold)
VALUES
    (NOW() - INTERVAL '15 minutes', 'cpu_usage_percent', 'web-server-01', 'api-gateway', 'warning', 'threshold', 'CPU usage exceeded 85% for 5 minutes', 87.3, 85.0),
    (NOW() - INTERVAL '5 minutes', 'memory_usage_percent', 'web-server-02', 'api-gateway', 'critical', 'threshold', 'Memory usage exceeded 90% for 5 minutes', 93.1, 90.0);
