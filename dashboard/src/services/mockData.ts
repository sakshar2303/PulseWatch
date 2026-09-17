import {
  QueryResult,
  ServiceInfo,
  HostInfo,
  AnomaliesResponse,
  HealthResponse,
  Remediation,
  RemediationStats,
} from '../types';
import { SLOResponse } from '../types/telemetry';

export const MOCK_SERVICES: ServiceInfo[] = [
  { name: 'checkout-service', last_seen: new Date().toISOString(), host_count: 3, status: 'healthy' },
  { name: 'auth-gateway', last_seen: new Date().toISOString(), host_count: 2, status: 'healthy' },
  { name: 'payment-api', last_seen: new Date().toISOString(), host_count: 2, status: 'warning' },
  { name: 'order-worker', last_seen: new Date().toISOString(), host_count: 4, status: 'healthy' },
  { name: 'inventory-db', last_seen: new Date().toISOString(), host_count: 2, status: 'healthy' },
];

export const MOCK_HOSTS: HostInfo[] = [
  { name: 'web-prod-01', service: 'checkout-service', last_seen: new Date().toISOString(), status: 'healthy' },
  { name: 'web-prod-02', service: 'checkout-service', last_seen: new Date().toISOString(), status: 'healthy' },
  { name: 'web-prod-03', service: 'checkout-service', last_seen: new Date().toISOString(), status: 'warning' },
  { name: 'api-auth-01', service: 'auth-gateway', last_seen: new Date().toISOString(), status: 'healthy' },
  { name: 'api-auth-02', service: 'auth-gateway', last_seen: new Date().toISOString(), status: 'healthy' },
  { name: 'worker-order-01', service: 'order-worker', last_seen: new Date().toISOString(), status: 'healthy' },
  { name: 'worker-order-02', service: 'order-worker', last_seen: new Date().toISOString(), status: 'healthy' },
  { name: 'db-master-01', service: 'inventory-db', last_seen: new Date().toISOString(), status: 'healthy' },
];

export const MOCK_METRICS = [
  'system.cpu.usage',
  'system.memory.usage',
  'system.disk.used_percent',
  'system.network.bytes_sent',
  'system.network.bytes_recv',
];

export function getMockQuery(metricName: string): QueryResult {
  const now = Date.now();
  const datapoints = [];
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now - i * 60000).toISOString();
    let base = 45;
    if (metricName.includes('cpu')) base = 55 + Math.sin(i / 3) * 20;
    else if (metricName.includes('memory')) base = 68 + Math.cos(i / 4) * 10;
    else if (metricName.includes('disk')) base = 42;
    else base = 1200 + Math.random() * 800;
    datapoints.push({ time: t, value: Math.max(5, Math.min(98, base + (Math.random() * 8 - 4))) });
  }

  return {
    metric_name: metricName,
    series: [
      {
        host: 'web-prod-01',
        service: 'checkout-service',
        datapoints,
      },
      {
        host: 'api-auth-01',
        service: 'auth-gateway',
        datapoints: datapoints.map((d) => ({
          time: d.time,
          value: Math.max(5, Math.min(95, d.value * 0.85 + (Math.random() * 6 - 3))),
        })),
      },
    ],
  };
}

export const MOCK_ANOMALIES: AnomaliesResponse = {
  anomalies: [
    {
      id: 101,
      detected_at: new Date(Date.now() - 4 * 60000).toISOString(),
      metric_name: 'system.cpu.usage',
      host: 'web-prod-03',
      service: 'checkout-service',
      severity: 'critical',
      type: 'isolation_forest',
      description: 'Sudden anomalous compute spike: CPU saturated at 94.2% with negative Isolation Forest score (-0.42).',
      value: 94.2,
      score: -0.42,
      resolved_at: null,
      rca_summary: 'RCA by Claude 3.5 Sonnet: Connection pool thread deadlock detected in checkout worker routine following un-indexed SQL aggregation query.',
    },
    {
      id: 102,
      detected_at: new Date(Date.now() - 18 * 60000).toISOString(),
      metric_name: 'system.memory.usage',
      host: 'api-auth-02',
      service: 'auth-gateway',
      severity: 'warning',
      type: 'threshold',
      description: 'Memory threshold exceeded: 83.7% > 80.0% warning threshold.',
      value: 83.7,
      threshold: 80.0,
      resolved_at: null,
      rca_summary: 'RCA by Claude 3.5 Sonnet: JWT verification cache accumulation without proper TTL eviction under sustained high auth request rates.',
    },
    {
      id: 103,
      detected_at: new Date(Date.now() - 45 * 60000).toISOString(),
      metric_name: 'system.disk.used_percent',
      host: 'worker-order-01',
      service: 'order-worker',
      severity: 'critical',
      type: 'threshold',
      description: 'Disk capacity warning: log partition at 91.5%.',
      value: 91.5,
      threshold: 90.0,
      resolved_at: new Date(Date.now() - 25 * 60000).toISOString(),
      rca_summary: 'RCA by Claude 3.5 Sonnet: Rotated log accumulation in /var/log/orders. Autonomously resolved via log_rotate_and_flush playbook.',
    },
  ],
  total: 3,
  limit: 10,
  offset: 0,
};

export const MOCK_REMEDIATIONS: Remediation[] = [
  {
    id: 1,
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    service: 'checkout-service',
    host: 'web-prod-03',
    metric_name: 'system.cpu.usage',
    action_type: 'recycle_db_pool',
    status: 'success',
    trigger_type: 'autonomous',
    metric_before: 94.2,
    metric_after: 38.5,
    llm_plan: 'Recycle exhausted PostgreSQL pool connections and re-initialize connection listener.',
    execution_log: 'Pool connections recycled successfully. Verification check passed.',
  },
  {
    id: 2,
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    service: 'order-worker',
    host: 'worker-order-01',
    metric_name: 'system.memory.usage',
    action_type: 'flush_cache',
    status: 'success',
    trigger_type: 'autonomous',
    metric_before: 89.1,
    metric_after: 42.0,
    llm_plan: 'Flush stale Redis memory cache and evict expired order queue keys.',
    execution_log: 'Redis memory buffer flushed. Memory usage stabilized at 42%.',
  },
  {
    id: 3,
    created_at: new Date(Date.now() - 65 * 60000).toISOString(),
    service: 'auth-gateway',
    host: 'api-auth-02',
    metric_name: 'system.cpu.usage',
    action_type: 'restart_container',
    status: 'success',
    trigger_type: 'manual',
    metric_before: 96.0,
    metric_after: 25.1,
    llm_plan: 'Execute rolling restart of auth-gateway worker pod on web-02.',
    execution_log: 'Container restarted cleanly. Health probes passing.',
  },
];

export const MOCK_REMEDIATION_STATS: RemediationStats = {
  total_remediations: 14,
  success_rate: 92.8,
  autonomous_count: 11,
  last_24h: 5,
};

export const MOCK_HEALTH: HealthResponse = {
  status: 'healthy',
  version: '1.2.0',
  uptime_seconds: 172800,
  dependencies: {
    timescaledb: { status: 'healthy', latency_ms: 1.2 },
    nats: { status: 'healthy', latency_ms: 0.8 },
  },
};

export const MOCK_SLO: SLOResponse = {
  slis: {
    window_seconds: 3600,
    total_requests: 124500,
    error_count: 14,
    success_rate: 99.988,
    latency_p50_ms: 2.1,
    latency_p95_ms: 8.4,
    latency_p99_ms: 19.5,
    latency_max_ms: 45.2,
    by_endpoint: {},
  },
  objectives: [
    {
      name: 'API Availability',
      target: 99.9,
      current: 99.988,
      in_compliance: true,
      budget_used_percent: 12.0,
    },
    {
      name: 'P99 Latency (< 50ms)',
      target: 99.0,
      current: 99.8,
      in_compliance: true,
      budget_used_percent: 20.0,
    },
  ],
};
