import React, { useState } from 'react';
import { SwarmRun } from '../../types/telemetry';
import { TraceWaterfall } from './TraceWaterfall';
import { ScenarioSimulator } from './ScenarioSimulator';

interface CheckpointsFeedProps {
  unresolvedAnomalyCount?: number;
}

const INITIAL_RUNS: SwarmRun[] = [
  {
    id: 'r_9af2',
    agentName: 'supportAgent',
    service: 'api-gateway',
    timestamp: 'Just now',
    durationMs: 42,
    status: 'recovered',
    statusText: 'Schema guard triggered · 1 pause resumed · 0 dupes',
    writesLanded: 1,
    checkpointsCount: 4,
    failingStep: 'schema_validation (order_lookup)',
    checkpoints: [
      {
        id: 'ckpt_0a4e',
        stepType: 'write_check',
        title: 'TimescaleDB write verified',
        detail: 'Checked table `metrics` · Row verified with valid timestamp',
        timeAgo: 'Just now',
        status: 'success',
        metadata: { table: 'metrics', rowsWritten: 1 },
      },
      {
        id: 'ckpt_0a4d',
        stepType: 'replay',
        title: 'Auto-recovery: schema reshape applied',
        detail: 'Counterfactual replay restarted from ckpt_0a4b with trimmed payload',
        timeAgo: '4s ago',
        status: 'warn',
        metadata: { latencyMs: 18 },
      },
      {
        id: 'ckpt_0a4c',
        stepType: 'tool_call',
        title: 'Tool call: lookup_order',
        detail: 'Running in prod/us-east-1 · Non-JSON returned by external provider',
        timeAgo: '7s ago',
        status: 'error',
        metadata: { tool: 'lookup_order' },
      },
      {
        id: 'ckpt_0a4a',
        stepType: 'entry',
        title: 'Run started',
        detail: 'Received inbound request traceparent=00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        timeAgo: '12s ago',
        status: 'info',
      },
    ],
  },
  {
    id: 'r_9ad7',
    agentName: 'ingestWorker-01',
    service: 'ingestion-service',
    timestamp: '2m ago',
    durationMs: 14,
    status: 'verified',
    statusText: 'Batch write landed · 500 rows committed to TimescaleDB',
    writesLanded: 500,
    checkpointsCount: 3,
    checkpoints: [
      {
        id: 'ckpt_0a3f',
        stepType: 'write_check',
        title: 'Batch insert committed',
        detail: 'TimescaleDB hypertable `metrics` updated · Ack sent to JetStream',
        timeAgo: '2m ago',
        status: 'success',
        metadata: { table: 'metrics', rowsWritten: 500, latencyMs: 14 },
      },
      {
        id: 'ckpt_0a3e',
        stepType: 'pre_llm',
        title: 'JetStream pull batch received',
        detail: 'Stream `METRICS` subject `metrics.*` pulled 500 points',
        timeAgo: '2m ago',
        status: 'info',
      },
      {
        id: 'ckpt_0a3a',
        stepType: 'entry',
        title: 'Batcher accumulator cycle',
        detail: 'Trigger: max batch size reached (500 pts)',
        timeAgo: '2m ago',
        status: 'info',
      },
    ],
  },
  {
    id: 'r_9ac1',
    agentName: 'collectorAgent-host1',
    service: 'telemetry-collector',
    timestamp: '5m ago',
    durationMs: 8,
    status: 'verified',
    statusText: 'NATS publish confirmed · Ring buffer empty (0 drops)',
    writesLanded: 8,
    checkpointsCount: 2,
    checkpoints: [
      {
        id: 'ckpt_0a2b',
        stepType: 'write_check',
        title: 'Published to NATS JetStream',
        detail: 'Subject `metrics.cpu` · Sequence ack=48291 received',
        timeAgo: '5m ago',
        status: 'success',
      },
      {
        id: 'ckpt_0a2a',
        stepType: 'tool_call',
        title: 'Local gopsutil sample taken',
        detail: 'CPU: 34.2%, RAM: 61.8%, Disk: 45.1%',
        timeAgo: '5m ago',
        status: 'info',
      },
    ],
  },
  {
    id: 'r_9ab6',
    agentName: 'mlDetector',
    service: 'anomaly-detector',
    timestamp: '8m ago',
    durationMs: 89,
    status: 'verified',
    statusText: 'Isolation Forest scoring · 12 series evaluated · 0 anomalies',
    writesLanded: 12,
    checkpointsCount: 3,
    checkpoints: [
      {
        id: 'ckpt_0a1c',
        stepType: 'write_check',
        title: 'Model predictions recorded',
        detail: 'Decision function evaluated over 30min historical window',
        timeAgo: '8m ago',
        status: 'success',
        metadata: { latencyMs: 89 },
      },
      {
        id: 'ckpt_0a1b',
        stepType: 'tool_call',
        title: 'Queried TimescaleDB hypertable',
        detail: 'Extracted rolling mean, stddev, and 1st differences',
        timeAgo: '8m ago',
        status: 'info',
      },
    ],
  },
  {
    id: 'r_9a9e',
    agentName: 'apiGateway',
    service: 'api-service',
    timestamp: '14m ago',
    durationMs: 4,
    status: 'verified',
    statusText: 'HTTP 200 GET /api/v1/slo · Traced via W3C TraceContext',
    writesLanded: 1,
    checkpointsCount: 2,
    checkpoints: [
      {
        id: 'ckpt_0a0b',
        stepType: 'write_check',
        title: 'SLI Metric recorded',
        detail: 'Rolling window recorded: path=/api/v1/slo, latency=4.1ms',
        timeAgo: '14m ago',
        status: 'success',
      },
      {
        id: 'ckpt_0a0a',
        stepType: 'entry',
        title: 'Inbound HTTP request',
        detail: 'Trace ID: 4bf92f3577b34da6a3ce929d0e0e4736',
        timeAgo: '14m ago',
        status: 'info',
      },
    ],
  },
];

export const CheckpointsFeed: React.FC<CheckpointsFeedProps> = () => {
  const [filter, setFilter] = useState<'all' | 'verified' | 'recovered' | 'anomalies'>('all');
  const [selectedRun, setSelectedRun] = useState<SwarmRun | null>(INITIAL_RUNS[0]);
  const [viewMode, setViewMode] = useState<'checkpoints' | 'waterfall'>('checkpoints');

  const filteredRuns = INITIAL_RUNS.filter((r) => {
    if (filter === 'verified') return r.status === 'verified';
    if (filter === 'recovered') return r.status === 'recovered';
    if (filter === 'anomalies') return r.status === 'anomaly' || r.status === 'schema_mismatch';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Live Chaos Scenario Simulator */}
      <ScenarioSimulator />

      {/* Reliability Banner Header */}
      <div className="hud-panel rounded-xl p-6 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-pulse-coral/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pulse-coral/10 border border-pulse-coral/20 text-pulse-coral text-xs font-mono mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pulse-coral animate-ping" />
              Live Checkpoint & Ground-Truth Verification
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Watch Every Write Land in TimescaleDB
            </h2>
            <p className="text-xs text-pulse-secondary mt-1 max-w-2xl">
              Tracing records what your agents claim they did. PulseWatch opens your database to verify the row actually landed, and triggers counterfactual replay for dropped writes.
            </p>
          </div>

          {/* Metric Badges */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-void-card px-3.5 py-2 rounded-lg border border-white/5">
              <div className="text-pulse-tertiary">Silent Failures</div>
              <div className="text-white font-bold text-base mt-0.5 flex items-center gap-1.5">
                <span>0 / day</span>
                <span className="text-[10px] text-pulse-emerald bg-pulse-emerald/10 px-1.5 py-0.5 rounded">100% verified</span>
              </div>
            </div>
            <div className="bg-void-card px-3.5 py-2 rounded-lg border border-white/5">
              <div className="text-pulse-tertiary">Baseline Drop</div>
              <div className="text-white font-bold text-base mt-0.5">
                <span className="text-pulse-coral">~2,500</span> → <span className="text-pulse-emerald">0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'all'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-pulse-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            All Swarm Runs ({INITIAL_RUNS.length})
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'verified'
                ? 'bg-pulse-emerald/20 text-pulse-emerald border border-pulse-emerald/30'
                : 'text-pulse-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            Verified Writes
          </button>
          <button
            onClick={() => setFilter('recovered')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'recovered'
                ? 'bg-pulse-coral/20 text-pulse-coral border border-pulse-coral/30'
                : 'text-pulse-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            Auto-Recovered
          </button>
          <button
            onClick={() => setFilter('anomalies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'anomalies'
                ? 'bg-pulse-rose/20 text-pulse-rose border border-pulse-rose/30'
                : 'text-pulse-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            Anomalies Caught
          </button>
        </div>
      </div>

      {/* Main Split Grid: Run List (Left) + Checkpoint Detail (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Run List Table */}
        <div className="lg:col-span-6 space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-pulse-tertiary px-1 flex items-center justify-between">
            <span>Recent Agent Runs</span>
            <span>Checkpoints Depth</span>
          </div>

          <div className="space-y-2">
            {filteredRuns.map((run) => {
              const isSelected = selectedRun?.id === run.id;
              return (
                <div
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className={`hud-panel rounded-xl p-4 cursor-pointer transition-all border ${
                    isSelected
                      ? 'border-pulse-coral/50 bg-void-elevated shadow-pulse-glow'
                      : 'border-white/5 hover:border-white/15 bg-void-card hover:bg-void-elevated'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs text-pulse-coral font-semibold">
                        {run.id}
                      </span>
                      <span className="text-xs font-medium text-white">
                        {run.agentName}
                      </span>
                      <span className="text-[11px] text-pulse-tertiary font-mono">
                        {run.service}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-pulse-tertiary">
                        {run.durationMs}ms
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          run.status === 'verified'
                            ? 'bg-pulse-emerald/10 text-pulse-emerald border-pulse-emerald/30'
                            : run.status === 'recovered'
                            ? 'bg-pulse-coral/10 text-pulse-coral border-pulse-coral/30'
                            : 'bg-pulse-rose/10 text-pulse-rose border-pulse-rose/30'
                        }`}
                      >
                        {run.status === 'verified' ? '✓ Verified' : '↺ Recovered'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-pulse-secondary mt-2 line-clamp-1">
                    {run.statusText}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5 text-[11px] font-mono text-pulse-tertiary">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-pulse-emerald" />
                      {run.writesLanded} write{run.writesLanded > 1 ? 's' : ''} landed
                    </span>
                    <span>{run.checkpointsCount} checkpoints · {run.timestamp}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkpoint Detail Inspector (Right Column) */}
        <div className="lg:col-span-6">
          {selectedRun ? (
            <div className="hud-panel rounded-xl p-6 border border-white/10 sticky top-20">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-pulse-coral">
                      {selectedRun.id}
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {selectedRun.agentName}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-pulse-tertiary mt-0.5">
                    Service: <span className="text-pulse-secondary">{selectedRun.service}</span> · Latency: {selectedRun.durationMs}ms
                  </div>
                </div>

                <a
                  href="http://localhost:16686"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-void-card hover:bg-white/10 border border-white/10 text-xs font-mono text-pulse-sky flex items-center gap-1.5 transition-colors"
                >
                  <span>Jaeger Trace</span>
                  <span>↗</span>
                </a>
              </div>

              {/* View Mode Toggle: Checkpoints vs Distributed Trace Waterfall */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                <button
                  onClick={() => setViewMode('checkpoints')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                    viewMode === 'checkpoints'
                      ? 'bg-pulse-coral/20 text-pulse-coral font-bold border border-pulse-coral/30'
                      : 'text-pulse-secondary hover:text-white bg-white/5'
                  }`}
                >
                  Step Checkpoints ({selectedRun.checkpoints.length})
                </button>
                <button
                  onClick={() => setViewMode('waterfall')}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                    viewMode === 'waterfall'
                      ? 'bg-pulse-sky/20 text-pulse-sky font-bold border border-pulse-sky/30'
                      : 'text-pulse-secondary hover:text-white bg-white/5'
                  }`}
                >
                  Distributed Trace Waterfall ⚡
                </button>
              </div>

              {/* Conditional Rendering: Checkpoints Timeline vs Trace Waterfall */}
              {viewMode === 'waterfall' ? (
                <div className="mt-4">
                  <TraceWaterfall
                    traceId="4bf92f3577b34da6a3ce929d0e0e4736"
                    totalDurationMs={selectedRun.durationMs}
                  />
                </div>
              ) : (
                <>
                  {/* Counterfactual Replay Box */}
                  {selectedRun.status === 'recovered' && (
                    <div className="mt-4 p-3.5 rounded-lg bg-pulse-coral/5 border border-pulse-coral/20 text-xs">
                      <div className="font-bold text-pulse-coral flex items-center gap-1.5 mb-1">
                        <span>↺</span> Counterfactual Replay & Self-Repair
                      </div>
                      <div className="text-pulse-secondary text-[11px] leading-relaxed">
                        Step <code className="font-mono text-pulse-coral bg-black/40 px-1 py-0.5 rounded">{selectedRun.failingStep}</code> failed schema check. Agent resumed execution from checkpoint <code className="font-mono text-white bg-black/40 px-1 py-0.5 rounded">ckpt_0a4b</code> and successfully committed write.
                      </div>
                    </div>
                  )}

                  {/* Checkpoint Step Timeline */}
                  <div className="mt-5">
                    <div className="text-xs font-mono uppercase tracking-wider text-pulse-tertiary mb-3">
                      Execution Checkpoint History
                    </div>

                    <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
                      {selectedRun.checkpoints.map((ckpt) => (
                        <div key={ckpt.id} className="relative flex items-start gap-3.5 pl-6 group">
                          {/* Timeline node */}
                          <span
                            className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 bg-void ${
                              ckpt.status === 'success'
                                ? 'border-pulse-emerald'
                                : ckpt.status === 'warn'
                                ? 'border-pulse-coral'
                                : ckpt.status === 'error'
                                ? 'border-pulse-rose'
                                : 'border-white/20'
                            }`}
                          />

                          <div className="flex-1 bg-void-card/60 p-3 rounded-lg border border-white/5 group-hover:border-white/15 transition-all">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-white">
                                {ckpt.title}
                              </span>
                              <span className="font-mono text-[10px] text-pulse-coral bg-pulse-coral/10 px-1.5 py-0.5 rounded">
                                {ckpt.id}
                              </span>
                            </div>
                            <p className="text-xs text-pulse-secondary mt-1">
                              {ckpt.detail}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-pulse-tertiary">
                              <span>{ckpt.timeAgo}</span>
                              {ckpt.metadata?.table && (
                                <span className="text-pulse-emerald">table: {ckpt.metadata.table}</span>
                              )}
                              {ckpt.metadata?.rowsWritten !== undefined && (
                                <span>{ckpt.metadata.rowsWritten} rows</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hud-panel rounded-xl p-12 text-center text-pulse-tertiary text-xs font-mono border border-white/5">
              Select a run from the left panel to inspect its checkpoints.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
