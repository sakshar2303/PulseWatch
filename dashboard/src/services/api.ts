import {
  QueryResult,
  ServiceInfo,
  HostInfo,
  AnomaliesResponse,
  HealthResponse,
  Remediation,
  RemediationStats,
} from '../types';

const API_BASE = '/api/v1';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/health');
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMetricNames(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/metrics/names`);
  if (!res.ok) {
    throw new Error(`Failed to fetch metric names: ${res.statusText}`);
  }
  const data = await res.json();
  return data.names || [];
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
  const url = new URL(`${API_BASE}/metrics/query`, window.location.origin);
  url.searchParams.set('name', params.name);

  if (params.start) url.searchParams.set('start', params.start);
  if (params.end) url.searchParams.set('end', params.end);
  if (params.step) url.searchParams.set('step', params.step);
  if (params.agg) url.searchParams.set('agg', params.agg);
  if (params.host) url.searchParams.set('host', params.host);
  if (params.service) url.searchParams.set('service', params.service);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Metric query failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchServices(): Promise<ServiceInfo[]> {
  const res = await fetch(`${API_BASE}/services`);
  if (!res.ok) {
    throw new Error(`Failed to fetch services: ${res.statusText}`);
  }
  const data = await res.json();
  return data.services || [];
}

export async function fetchHosts(): Promise<HostInfo[]> {
  const res = await fetch(`${API_BASE}/hosts`);
  if (!res.ok) {
    throw new Error(`Failed to fetch hosts: ${res.statusText}`);
  }
  const data = await res.json();
  return data.hosts || [];
}

export interface FetchAnomaliesParams {
  service?: string;
  severity?: string;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}

export async function fetchAnomalies(params?: FetchAnomaliesParams): Promise<AnomaliesResponse> {
  const url = new URL(`${API_BASE}/anomalies`, window.location.origin);
  if (params?.service) url.searchParams.set('service', params.service);
  if (params?.severity) url.searchParams.set('severity', params.severity);
  if (params?.resolved !== undefined) url.searchParams.set('resolved', String(params.resolved));
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.offset) url.searchParams.set('offset', String(params.offset));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch anomalies: ${res.statusText}`);
  }
  return res.json();
}

export async function resolveAnomaly(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/anomalies/${id}/resolve`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve anomaly: ${res.statusText}`);
  }
}

export async function fetchSLO(): Promise<import('../types/telemetry').SLOResponse> {
  const res = await fetch(`${API_BASE}/slo`);
  if (!res.ok) {
    throw new Error(`Failed to fetch SLO metrics: ${res.statusText}`);
  }
  return res.json();
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
  const res = await fetch(`${API_BASE}/ai/nl-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, metric_names: metricNames }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `NL query failed: ${res.statusText}`);
  }
  return res.json();
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
  const url = new URL(`${API_BASE}/forecasts`, window.location.origin);
  url.searchParams.set('metric', metric);
  url.searchParams.set('host', host);
  url.searchParams.set('service', service);
  
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch forecasts: ${res.statusText}`);
  }
  const data = await res.json();
  return data.forecasts || [];
}

export async function fetchRemediations(limit = 50, status?: string, service?: string): Promise<Remediation[]> {
  const url = new URL(`${API_BASE}/remediations`, window.location.origin);
  url.searchParams.set('limit', limit.toString());
  if (status) url.searchParams.set('status', status);
  if (service) url.searchParams.set('service', service);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch remediations: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRemediationStats(): Promise<RemediationStats> {
  const res = await fetch(`${API_BASE}/remediations/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch remediation stats: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRemediation(id: number): Promise<Remediation> {
  const res = await fetch(`${API_BASE}/remediations/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch remediation ${id}: ${res.statusText}`);
  }
  return res.json();
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
  const res = await fetch(`${API_BASE}/remediations/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger remediation: ${res.statusText}`);
  }
  return res.json();
}
