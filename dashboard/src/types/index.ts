export interface MetricPoint {
  metric_name: string;
  value: number;
  timestamp: string;
  host: string;
  service: string;
  tags?: Record<string, string>;
  collector_id?: string;
  sequence_num?: number;
}

export interface Datapoint {
  time: string;
  value: number;
}

export interface SeriesResult {
  host: string;
  service: string;
  datapoints: Datapoint[];
}

export interface QueryResult {
  metric_name: string;
  series: SeriesResult[];
}

export interface ServiceInfo {
  name: string;
  last_seen: string;
  host_count: number;
  status: 'healthy' | 'warning' | 'offline';
}

export interface HostInfo {
  name: string;
  service: string;
  last_seen: string;
  status: 'healthy' | 'warning' | 'offline';
}

export interface Anomaly {
  id: number;
  detected_at: string;
  metric_name: string;
  host: string;
  service: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  description: string;
  value: number;
  threshold?: number | null;
  score?: number | null;
  resolved_at?: string | null;
  metadata?: Record<string, any>;
}

export interface AnomaliesResponse {
  anomalies: Anomaly[];
  total: number;
  limit: number;
  offset: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version?: string;
  uptime_seconds?: number;
  dependencies?: {
    timescaledb?: { status: string; latency_ms?: number };
    nats?: { status: string; latency_ms?: number };
  };
}

export type TimeRangePreset = '5m' | '15m' | '1h' | '6h' | '24h' | '7d';

export interface TimeRangeConfig {
  label: string;
  value: TimeRangePreset;
  durationMs: number;
  defaultStep: string;
}

export * from './telemetry';
