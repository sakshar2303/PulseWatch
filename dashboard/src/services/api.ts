import {
  QueryResult,
  ServiceInfo,
  HostInfo,
  AnomaliesResponse,
  HealthResponse,
  Remediation,
  RemediationStats,
} from '../types';
import {
  MOCK_SERVICES,
  MOCK_HOSTS,
  MOCK_METRICS,
  getMockQuery,
  MOCK_ANOMALIES,
  MOCK_REMEDIATIONS,
  MOCK_REMEDIATION_STATS,
  MOCK_HEALTH,
  MOCK_SLO,
} from './mockData';

const API_BASE = '/api/v1';

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return MOCK_HEALTH;
  }
}

export async function fetchMetricNames(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/metrics/names`);
    if (!res.ok) throw new Error(`Failed to fetch metric names: ${res.statusText}`);
    const data = await res.json();
    return data.names || MOCK_METRICS;
  } catch (err) {
    return MOCK_METRICS;
  }
}

export interface QueryMetricsParams {
  name: string;
  start?: string;
  end?: string;
  step?: string;
  agg?: 'avg' | 'max' | 'min' | 'sum' | 'count';
  host?: string;
  service?: string;
}

export async function queryMetrics(params: QueryMetricsParams): Promise<QueryResult> {
  try {
    const url = new URL(`${API_BASE}/metrics/query`, window.location.origin);
    url.searchParams.set('name', params.name);

    if (params.start) url.searchParams.set('start', params.start);
    if (params.end) url.searchParams.set('end', params.end);
    if (params.step) url.searchParams.set('step', params.step);
    if (params.agg) url.searchParams.set('agg', params.agg);
    if (params.host) url.searchParams.set('host', params.host);
    if (params.service) url.searchParams.set('service', params.service);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Metric query failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return getMockQuery(params.name);
  }
}

export async function fetchServices(): Promise<ServiceInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/services`);
    if (!res.ok) throw new Error(`Failed to fetch services: ${res.statusText}`);
    const data = await res.json();
    return data.services || MOCK_SERVICES;
  } catch (err) {
    return MOCK_SERVICES;
  }
}

export async function fetchHosts(): Promise<HostInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/hosts`);
    if (!res.ok) throw new Error(`Failed to fetch hosts: ${res.statusText}`);
    const data = await res.json();
    return data.hosts || MOCK_HOSTS;
  } catch (err) {
    return MOCK_HOSTS;
  }
}

export interface FetchAnomaliesParams {
  service?: string;
  severity?: string;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}

export async function fetchAnomalies(params?: FetchAnomaliesParams): Promise<AnomaliesResponse> {
  try {
    const url = new URL(`${API_BASE}/anomalies`, window.location.origin);
    if (params?.service) url.searchParams.set('service', params.service);
    if (params?.severity) url.searchParams.set('severity', params.severity);
    if (params?.resolved !== undefined) url.searchParams.set('resolved', String(params.resolved));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    if (params?.offset) url.searchParams.set('offset', String(params.offset));

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch anomalies: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return MOCK_ANOMALIES;
  }
}

export async function resolveAnomaly(id: number): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/anomalies/${id}/resolve`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error(`Failed to resolve anomaly: ${res.statusText}`);
  } catch (err) {
    // In demo mode, simulate resolution
    const a = MOCK_ANOMALIES.anomalies.find((x) => x.id === id);
    if (a) {
      a.resolved_at = new Date().toISOString();
    }
  }
}

export async function fetchSLO(): Promise<import('../types/telemetry').SLOResponse> {
  try {
    const res = await fetch(`${API_BASE}/slo`);
    if (!res.ok) throw new Error(`Failed to fetch SLO metrics: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return MOCK_SLO;
  }
}

export interface NLQueryResult {
  metric_name: string;
  aggregation: 'avg' | 'max' | 'min';
  time_range: string;
  host: string;
  service: string;
  explanation: string;
}

export async function nlQuery(prompt: string, metricNames?: string[]): Promise<NLQueryResult> {
  try {
    const res = await fetch(`${API_BASE}/ai/nl-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, metric_names: metricNames }),
    });
    if (!res.ok) throw new Error(`NL query failed: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return {
      metric_name: 'system.cpu.usage',
      aggregation: 'avg',
      time_range: '1h',
      host: 'web-prod-01',
      service: 'checkout-service',
      explanation: `Parsed prompt: "${prompt}". Returning average CPU usage on checkout-service web-prod-01 over the last hour.`,
    };
  }
}

export interface Forecast {
  id: number;
  generated_at: string;
  metric_name: string;
  host: string;
  service: string;
  forecast_time: string;
  predicted_value: number;
  lower_bound?: number;
  upper_bound?: number;
  horizon_minutes: number;
  model_type: string;
}

export async function fetchForecasts(metric: string, host: string, service: string): Promise<Forecast[]> {
  try {
    const url = new URL(`${API_BASE}/forecasts`, window.location.origin);
    url.searchParams.set('metric', metric);
    url.searchParams.set('host', host);
    url.searchParams.set('service', service);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch forecasts: ${res.statusText}`);
    const data = await res.json();
    return data.forecasts || [];
  } catch (err) {
    const now = Date.now();
    return [
      {
        id: 1,
        generated_at: new Date(now).toISOString(),
        metric_name: metric,
        host,
        service,
        forecast_time: new Date(now + 15 * 60000).toISOString(),
        predicted_value: 62.4,
        lower_bound: 55.0,
        upper_bound: 70.0,
        horizon_minutes: 15,
        model_type: 'holt_winters',
      },
      {
        id: 2,
        generated_at: new Date(now).toISOString(),
        metric_name: metric,
        host,
        service,
        forecast_time: new Date(now + 30 * 60000).toISOString(),
        predicted_value: 65.1,
        lower_bound: 56.5,
        upper_bound: 74.0,
        horizon_minutes: 30,
        model_type: 'holt_winters',
      },
    ];
  }
}

export async function fetchRemediations(limit = 50, status?: string, service?: string): Promise<Remediation[]> {
  try {
    const url = new URL(`${API_BASE}/remediations`, window.location.origin);
    url.searchParams.set('limit', limit.toString());
    if (status) url.searchParams.set('status', status);
    if (service) url.searchParams.set('service', service);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch remediations: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return MOCK_REMEDIATIONS;
  }
}

export async function fetchRemediationStats(): Promise<RemediationStats> {
  try {
    const res = await fetch(`${API_BASE}/remediations/stats`);
    if (!res.ok) throw new Error(`Failed to fetch remediation stats: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return MOCK_REMEDIATION_STATS;
  }
}

export async function fetchRemediation(id: number): Promise<Remediation> {
  try {
    const res = await fetch(`${API_BASE}/remediations/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch remediation ${id}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    return MOCK_REMEDIATIONS[0];
  }
}

export async function triggerRemediation(payload: {
  service: string;
  host: string;
  metric_name: string;
  current_value: number;
  description: string;
  severity: string;
  anomaly_id?: number;
  rca_summary?: string;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/remediations/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to trigger remediation: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    // Return simulated success in demo mode
    return {
      status: 'success',
      remediation_id: Date.now(),
      action: 'recycle_db_pool',
      verification_passed: true,
      duration_ms: 1240,
      message: `[Demo Mode] Autonomous playbook executed for ${payload.service} (${payload.host}). Stabilization verified.`,
    };
  }
}
