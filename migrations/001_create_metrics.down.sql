-- ==============================================================================
-- Migration 001 (down): Drop metrics hypertable
-- ==============================================================================
-- WARNING: This drops all metric data. Use only in development.
-- ==============================================================================

DROP TABLE IF EXISTS metrics CASCADE;
