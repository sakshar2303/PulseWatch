import {
  QueryResult,
  ServiceInfo,
  HostInfo,
  AnomaliesResponse,
  HealthResponse,
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
