import React, { useState } from 'react';
import { Server, Database, Radio, Cpu, Activity, Layers, ArrowRight } from 'lucide-react';

interface PipelineNode {
  id: string;
  name: string;
  role: string;
  technology: string;
  status: 'healthy' | 'warning' | 'error';
  throughput: string;
  latency: string;
  details: {
    description: string;
    specs: Record<string, string>;
  };
}

const NODES: PipelineNode[] = [
  {
    id: 'collectors',
    name: 'Collector Agents',
    role: 'Per-host system metrics daemon',
    technology: 'Go + gopsutil + Ring Buffer',
    status: 'healthy',
    throughput: '2,040 pts/sec',
    latency: '< 0.5ms',
    details: {
      description: 'Distributed Go agents deployed per host collecting CPU, RAM, Disk, and Network telemetry every 10s with local disk ring buffer fallback.',
      specs: {
        'Buffer Capacity': '1,024 points (FIFO)',
        'Collection Interval': '10 seconds',
        'Backpressure Policy': 'Local ring buffer + exponential backoff',
        'Protocol': 'NATS JetStream async publish',
      },
    },
  },
  {
    id: 'nats',
    name: 'NATS JetStream',
    role: 'Durable message streaming broker',
    technology: 'NATS 2.10 + JetStream',
    status: 'healthy',
    throughput: '2,040 msgs/sec',
    latency: '1.2ms p99',
    details: {
      description: 'Persistence queue providing asynchronous decoupling between collectors and ingestion workers with limits-based retention.',
      specs: {
        'Stream Name': 'METRICS',
        'Subject Filter': 'metrics.>',
        'Storage Type': 'File-backed persistent storage',
        'Retention Policy': 'Limits (1h / 1GB / 10M msgs)',
        'Discard Policy': 'DiscardOld (drops oldest when full)',
      },
    },
  },
  {
    id: 'ingestion',
    name: 'Ingestion Service',
    role: 'Batch writer to TimescaleDB',
    technology: 'Go + pgx/v5 connection pool',
    status: 'healthy',
    throughput: '500 pts/batch',
    latency: '14.2ms commit',
    details: {
      description: 'Pull-based JetStream consumer accumulating batches of up to 500 points or 1s flush timeout, writing via binary COPY protocol.',
      specs: {
        'Batch Size': '500 points',
        'Flush Timeout': '1,000ms',
        'Max Redelivery': '5 attempts before DLQ',
        'Connection Pool': 'pgxpool (max 20 connections)',
      },
    },
  },
  {
    id: 'timescaledb',
    name: 'TimescaleDB',
    role: 'Time-series relational storage',
    technology: 'PostgreSQL 16 + TimescaleDB extension',
    status: 'healthy',
    throughput: '12.4k rows/sec',
    latency: '3.8ms query',
    details: {
      description: 'Partitioned hypertable with 7-day chunk intervals and JSONB tag indices for flexible multi-dimensional filtering.',
      specs: {
        'Hypertable': 'metrics (time, metric_name, value, host, service, tags)',
        'Chunk Interval': '7 days',
        'Compression': 'Segment-by host, metric_name',
        'Retention': 'Chunk drop after 30 days',
      },
    },
  },
  {
    id: 'detector',
    name: 'Anomaly Detector',
    role: 'ML anomaly scoring & rules engine',
    technology: 'Python 3.11 + scikit-learn + FastAPI',
    status: 'healthy',
    throughput: '12 series/5min',
    latency: '82ms eval',
    details: {
      description: 'Autonomous service running Isolation Forest unsupervised anomaly detection over 30-minute historical telemetry windows.',
      specs: {
        'Algorithm': 'Isolation Forest (n_estimators=100)',
        'Feature Engineering': 'Rolling mean, stddev, 1st differences',
        'Polling Interval': 'Every 5 minutes',
        'Deduplication': '30-minute cooldown per metric',
      },
    },
  },
  {
    id: 'api',
    name: 'Query & API Gateway',
    role: 'REST API & WebSocket live broadcaster',
    technology: 'Go net/http + gorilla/websocket',
    status: 'healthy',
    throughput: '340 req/sec',
    latency: '1.8ms p50',
    details: {
      description: 'Serves time_bucket downsampled queries, real-time WebSocket metric broadcasts, and SLO compliance tracking.',
      specs: {
        'Downsampling': 'TimescaleDB time_bucket() queries',
        'WebSocket Broadcast': 'Live pub/sub hub with client filters',
        'SLO Monitoring': 'In-memory SLI collector (< 500ms p99)',
        'Tracing': 'OpenTelemetry W3C TraceContext middleware',
      },
    },
  },
];

export const ServiceMap: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<PipelineNode>(NODES[0]);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="hud-panel rounded-xl p-6 border border-white/5 relative overflow-hidden bg-void-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pulse-coral/10 border border-pulse-coral/20 text-pulse-coral text-xs font-mono mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pulse-coral animate-ping" />
              Live Architecture Topology & Dataflow
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              PulseWatch End-to-End System Topology
            </h2>
            <p className="text-xs text-pulse-secondary mt-1 max-w-2xl">
              Inspect real-time health, buffer queues, batch flushes, and dataflow rates across all 6 core microservices in the pipeline.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-2 rounded-lg bg-void border border-white/5">
              <span className="text-pulse-tertiary block text-[10px]">TOTAL THROUGHPUT</span>
              <span className="text-white font-bold text-sm text-pulse-emerald font-mono">2,040 pts/sec</span>
            </div>
            <div className="px-3 py-2 rounded-lg bg-void border border-white/5">
              <span className="text-pulse-tertiary block text-[10px]">PIPELINE LOSS</span>
              <span className="text-white font-bold text-sm text-pulse-emerald font-mono">0.00%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Topology Graph Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Node Pipeline Map (Left 8 cols) */}
        <div className="lg:col-span-8 hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card relative">
          <div className="text-xs font-mono uppercase tracking-wider text-pulse-tertiary mb-6 flex items-center justify-between">
            <span>Telemetry Pipeline Dataflow</span>
            <span className="text-pulse-coral flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pulse-coral animate-ping" />
              Real-time telemetry active
            </span>
          </div>

          {/* Pipeline Stages Flow */}
          <div className="space-y-6">
            {/* Stage 1: Collection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => setSelectedNode(NODES[0])}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedNode.id === 'collectors'
                    ? 'border-pulse-coral bg-void-elevated shadow-pulse-glow'
                    : 'border-white/5 bg-void hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-pulse-coral/15 text-pulse-coral">
                    <Server className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-pulse-emerald bg-pulse-emerald/10 px-2 py-0.5 rounded-full">
                    ● Active
                  </span>
                </div>
                <div className="text-xs font-bold text-white font-mono">{NODES[0].name}</div>
                <div className="text-[11px] text-pulse-tertiary truncate">{NODES[0].technology}</div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-pulse-secondary">{NODES[0].throughput}</span>
                  <span className="text-pulse-coral">{NODES[0].latency}</span>
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden md:flex items-center justify-center">
                <div className="flex items-center gap-1 text-pulse-coral font-mono text-xs">
                  <span className="animate-pulse">━━━</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* Stage 2: Queue */}
              <div
                onClick={() => setSelectedNode(NODES[1])}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedNode.id === 'nats'
                    ? 'border-pulse-coral bg-void-elevated shadow-pulse-glow'
                    : 'border-white/5 bg-void hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-pulse-sky/15 text-pulse-sky">
                    <Radio className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-pulse-emerald bg-pulse-emerald/10 px-2 py-0.5 rounded-full">
                    ● JetStream
                  </span>
                </div>
                <div className="text-xs font-bold text-white font-mono">{NODES[1].name}</div>
                <div className="text-[11px] text-pulse-tertiary truncate">{NODES[1].technology}</div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-pulse-secondary">{NODES[1].throughput}</span>
                  <span className="text-pulse-sky">{NODES[1].latency}</span>
                </div>
              </div>
            </div>

            {/* Vertical Flow Divider */}
            <div className="flex justify-end pr-12">
              <div className="h-6 w-0.5 bg-gradient-to-b from-pulse-sky to-pulse-emerald" />
            </div>

            {/* Stage 3: Ingestion & Storage */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => setSelectedNode(NODES[2])}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedNode.id === 'ingestion'
                    ? 'border-pulse-coral bg-void-elevated shadow-pulse-glow'
                    : 'border-white/5 bg-void hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-pulse-amber/15 text-pulse-amber">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-pulse-emerald bg-pulse-emerald/10 px-2 py-0.5 rounded-full">
                    ● Batching
                  </span>
                </div>
                <div className="text-xs font-bold text-white font-mono">{NODES[2].name}</div>
                <div className="text-[11px] text-pulse-tertiary truncate">{NODES[2].technology}</div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-pulse-secondary">{NODES[2].throughput}</span>
                  <span className="text-pulse-amber">{NODES[2].latency}</span>
                </div>
              </div>

              {/* Arrow Connector */}
              <div className="hidden md:flex items-center justify-center">
                <div className="flex items-center gap-1 text-pulse-emerald font-mono text-xs">
                  <span className="animate-pulse">━━━</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* Database */}
              <div
                onClick={() => setSelectedNode(NODES[3])}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedNode.id === 'timescaledb'
                    ? 'border-pulse-coral bg-void-elevated shadow-pulse-glow'
                    : 'border-white/5 bg-void hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-pulse-emerald/15 text-pulse-emerald">
                    <Database className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-pulse-emerald bg-pulse-emerald/10 px-2 py-0.5 rounded-full">
                    ● Hypertable
                  </span>
                </div>
                <div className="text-xs font-bold text-white font-mono">{NODES[3].name}</div>
                <div className="text-[11px] text-pulse-tertiary truncate">{NODES[3].technology}</div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-pulse-secondary">{NODES[3].throughput}</span>
                  <span className="text-pulse-emerald">{NODES[3].latency}</span>
                </div>
              </div>
            </div>

            {/* Vertical Flow to Consuming Services */}
            <div className="flex justify-between px-12">
              <div className="h-6 w-0.5 bg-white/10" />
              <div className="h-6 w-0.5 bg-white/10" />
            </div>

            {/* Stage 4: Consumers (ML Detector & API) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setSelectedNode(NODES[4])}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedNode.id === 'detector'
                    ? 'border-pulse-coral bg-void-elevated shadow-pulse-glow'
                    : 'border-white/5 bg-void hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-pulse-rose/15 text-pulse-rose">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-pulse-emerald bg-pulse-emerald/10 px-2 py-0.5 rounded-full">
                    ● Scikit-Learn
                  </span>
                </div>
                <div className="text-xs font-bold text-white font-mono">{NODES[4].name}</div>
                <div className="text-[11px] text-pulse-tertiary truncate">{NODES[4].technology}</div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-pulse-secondary">{NODES[4].throughput}</span>
                  <span className="text-pulse-rose">{NODES[4].latency}</span>
                </div>
              </div>

              <div
                onClick={() => setSelectedNode(NODES[5])}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedNode.id === 'api'
                    ? 'border-pulse-coral bg-void-elevated shadow-pulse-glow'
                    : 'border-white/5 bg-void hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-pulse-sky/15 text-pulse-sky">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-pulse-emerald bg-pulse-emerald/10 px-2 py-0.5 rounded-full">
                    ● net/http + WS
                  </span>
                </div>
                <div className="text-xs font-bold text-white font-mono">{NODES[5].name}</div>
                <div className="text-[11px] text-pulse-tertiary truncate">{NODES[5].technology}</div>
                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-pulse-secondary">{NODES[5].throughput}</span>
                  <span className="text-pulse-sky">{NODES[5].latency}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Node Inspector (Right 4 cols) */}
        <div className="lg:col-span-4">
          <div className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card sticky top-20">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-pulse-tertiary">
                  Component Inspector
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-0.5">
                  {selectedNode.name}
                </h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-pulse-emerald/10 text-pulse-emerald border border-pulse-emerald/20">
                HEALTHY
              </span>
            </div>

            <p className="text-xs text-pulse-secondary mt-3 leading-relaxed">
              {selectedNode.details.description}
            </p>

            <div className="mt-5 space-y-2.5">
              <div className="text-[11px] font-mono uppercase text-pulse-tertiary tracking-wider">
                Operational Specifications
              </div>

              {Object.entries(selectedNode.details.specs).map(([key, val]) => (
                <div key={key} className="p-2.5 rounded-lg bg-void border border-white/5 text-xs font-mono flex items-center justify-between">
                  <span className="text-pulse-secondary">{key}</span>
                  <span className="text-white font-semibold truncate ml-2 text-right">{val}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono">
              <span className="text-pulse-tertiary">Current Rate:</span>
              <span className="text-pulse-coral font-bold">{selectedNode.throughput}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
