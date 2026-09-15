import React, { useState } from 'react';

export interface SpanNode {
  id: string;
  name: string;
  service: string;
  startOffsetMs: number;
  durationMs: number;
  status: 'ok' | 'error' | 'warn';
  tags: Record<string, string | number>;
  children?: SpanNode[];
}

interface TraceWaterfallProps {
  traceId?: string;
  totalDurationMs?: number;
}

const SAMPLE_TRACE: SpanNode = {
  id: 'span_01a',
  name: 'HTTP POST /api/v1/metrics',
  service: 'api-gateway',
  startOffsetMs: 0,
  durationMs: 42.4,
  status: 'ok',
  tags: {
    'http.method': 'POST',
    'http.status_code': 200,
    'http.route': '/api/v1/metrics',
    'net.peer.ip': '10.0.4.12',
  },
  children: [
    {
      id: 'span_02b',
      name: 'nats.publish [subject=metrics.cpu]',
      service: 'collector-agent',
      startOffsetMs: 1.2,
      durationMs: 3.4,
      status: 'ok',
      tags: {
        'nats.subject': 'metrics.cpu',
        'nats.sequence': 48291,
        'nats.stream': 'METRICS',
      },
    },
    {
      id: 'span_03c',
      name: 'ingestion.batch_flush',
      service: 'ingestion-service',
      startOffsetMs: 5.6,
      durationMs: 22.8,
      status: 'ok',
      tags: {
        'batch.size': 500,
        'db.system': 'timescaledb',
        'db.table': 'metrics',
      },
      children: [
        {
          id: 'span_04d',
          name: 'pgxpool.acquire_connection',
          service: 'ingestion-service',
          startOffsetMs: 6.2,
          durationMs: 1.8,
          status: 'ok',
          tags: {
            'pool.idle_connections': 14,
          },
        },
        {
          id: 'span_05e',
          name: 'timescaledb.copy_hypertable',
          service: 'timescaledb',
          startOffsetMs: 8.5,
          durationMs: 19.4,
          status: 'ok',
          tags: {
            'db.statement': 'COPY metrics FROM STDIN BINARY',
            'rows.affected': 500,
          },
        },
      ],
    },
    {
      id: 'span_06f',
      name: 'detector.score_isolation_forest',
      service: 'anomaly-detector',
      startOffsetMs: 29.1,
      durationMs: 12.6,
      status: 'ok',
      tags: {
        'model.name': 'IsolationForest',
        'anomaly.detected': 'false',
        'anomaly.score': -0.18,
      },
    },
  ],
};

export const TraceWaterfall: React.FC<TraceWaterfallProps> = ({
  traceId = '4bf92f3577b34da6a3ce929d0e0e4736',
  totalDurationMs = 45.0,
}) => {
  const [selectedSpan, setSelectedSpan] = useState<SpanNode>(SAMPLE_TRACE);

  // Flatten spans for waterfall view with depth
  const flattened: { span: SpanNode; depth: number }[] = [];
  const traverse = (node: SpanNode, depth: number) => {
    flattened.push({ span: node, depth });
    if (node.children) {
      node.children.forEach((c) => traverse(c, depth + 1));
    }
  };
  traverse(SAMPLE_TRACE, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-omium-tertiary">Trace ID:</span>
          <span className="font-mono text-xs text-omium-sky font-semibold bg-omium-sky/10 px-2 py-0.5 rounded border border-omium-sky/20">
            {traceId}
          </span>
        </div>
        <div className="text-xs font-mono text-omium-secondary">
          Total Duration: <span className="text-white font-bold">{totalDurationMs}ms</span>
        </div>
      </div>

      {/* Waterfall Spans */}
      <div className="space-y-2">
        {flattened.map(({ span, depth }) => {
          const isSelected = selectedSpan?.id === span.id;
          const leftPercent = (span.startOffsetMs / totalDurationMs) * 100;
          const widthPercent = Math.max(3, (span.durationMs / totalDurationMs) * 100);

          return (
            <div
              key={span.id}
              onClick={() => setSelectedSpan(span)}
              className={`p-2 rounded-lg cursor-pointer transition-all border ${
                isSelected
                  ? 'border-omium-coral/50 bg-void-elevated shadow-sm'
                  : 'border-white/5 hover:border-white/15 bg-void-card'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <div className="flex items-center gap-2 truncate" style={{ paddingLeft: `${depth * 14}px` }}>
                  <span className="text-omium-coral text-[10px]">{depth > 0 ? '↳' : '•'}</span>
                  <span className="text-white font-semibold truncate">{span.name}</span>
                  <span className="text-[10px] text-omium-tertiary bg-white/5 px-1 rounded">
                    {span.service}
                  </span>
                </div>
                <span className="text-omium-secondary text-[11px] shrink-0 font-mono">
                  {span.durationMs.toFixed(1)}ms
                </span>
              </div>

              {/* Timeline bar */}
              <div className="w-full bg-white/[0.04] h-2 rounded-full relative overflow-hidden">
                <div
                  className={`absolute h-full rounded-full transition-all ${
                    span.service === 'timescaledb'
                      ? 'bg-omium-emerald'
                      : span.service === 'collector-agent'
                      ? 'bg-omium-coral'
                      : span.service === 'anomaly-detector'
                      ? 'bg-omium-amber'
                      : 'bg-omium-sky'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Span Attributes Inspector */}
      {selectedSpan && (
        <div className="mt-4 p-4 rounded-xl bg-void border border-white/[0.08]">
          <div className="flex items-center justify-between text-xs font-mono mb-3">
            <span className="text-omium-tertiary uppercase tracking-wider">Span Attributes</span>
            <span className="text-omium-coral font-bold">{selectedSpan.id}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-void-card border border-white/5 flex items-center justify-between">
              <span className="text-omium-tertiary">Service</span>
              <span className="text-white font-semibold">{selectedSpan.service}</span>
            </div>
            <div className="p-2 rounded bg-void-card border border-white/5 flex items-center justify-between">
              <span className="text-omium-tertiary">Duration</span>
              <span className="text-white font-semibold">{selectedSpan.durationMs}ms</span>
            </div>
            {Object.entries(selectedSpan.tags).map(([k, v]) => (
              <div key={k} className="p-2 rounded bg-void-card border border-white/5 flex items-center justify-between col-span-1 md:col-span-2">
                <span className="text-omium-secondary">{k}</span>
                <span className="text-omium-sky font-semibold">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
