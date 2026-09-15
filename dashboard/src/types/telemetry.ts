export type RunStatus = 'verified' | 'schema_mismatch' | 'recovered' | 'in_flight' | 'anomaly';

export interface CheckpointItem {
  id: string; // e.g. "ckpt_0a4c"
  stepType: 'tool_call' | 'post_llm' | 'pre_llm' | 'write_check' | 'entry' | 'replay';
  title: string;
  detail: string;
  timeAgo: string;
  status: 'success' | 'warn' | 'error' | 'info';
  metadata?: {
    tool?: string;
    table?: string;
    latencyMs?: number;
    rowsWritten?: number;
  };
}

export interface SwarmRun {
  id: string; // e.g. "r_9af2"
  agentName: string; // e.g. "collector-agent-01", "ingestion-worker"
  service: string; // "api-gateway", "telemetry-collector"
  timestamp: string;
  durationMs: number;
  status: RunStatus;
  statusText: string;
  writesLanded: number;
  checkpointsCount: number;
  failingStep?: string;
  checkpoints: CheckpointItem[];
}

export interface SLOTarget {
  name: string;
  target: number;
  current: number;
  in_compliance: boolean;
  budget_used_percent: number;
}

export interface EndpointSLI {
  requests: number;
  errors: number;
  success_rate: number;
  p50_ms: number;
  p99_ms: number;
}

export interface SLISnapshot {
  window_seconds: number;
  total_requests: number;
  error_count: number;
  success_rate: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  latency_max_ms: number;
  by_endpoint: Record<string, EndpointSLI>;
}

export interface SLOResponse {
  slis: SLISnapshot;
  objectives: SLOTarget[];
}
