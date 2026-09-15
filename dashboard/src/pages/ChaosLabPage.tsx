import React, { useState, useCallback } from 'react';
import {
  Zap, Play, StopCircle, AlertTriangle, CheckCircle2,
  Clock, Activity,
  Server, Wifi, Database, Cpu,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type ScenarioStatus = 'idle' | 'running' | 'recovering' | 'recovered' | 'failed';
type BlastLevel = 'low' | 'medium' | 'high' | 'critical';

interface ChaosScenario {
  id: string;
  name: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  blastRadius: BlastLevel;
  estimatedRecovery: string;
  affectedServices: string[];
  category: 'network' | 'resource' | 'data' | 'cascade';
}

interface TimelineEvent {
  t: number; // seconds since start
  msg: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

interface RunState {
  scenarioId: string;
  status: ScenarioStatus;
  startedAt: Date;
  elapsed: number;
  events: TimelineEvent[];
  errorRate: number;
  recoveryPct: number;
}

// ─── Data ──────────────────────────────────────────────────────────────────

const SCENARIOS: ChaosScenario[] = [
  {
    id: 'network-partition',
    name: 'Network Partition',
    description: 'Drops all NATS JetStream connections for 10 seconds, forcing the ingestion service to buffer locally.',
    icon: Wifi,
    blastRadius: 'high',
    estimatedRecovery: '~8s',
    affectedServices: ['ingestion-service', 'api-service', 'nats-jetstream'],
    category: 'network',
  },
  {
    id: 'db-overload',
    name: 'TimescaleDB Saturation',
    description: 'Floods TimescaleDB with 50K concurrent writes to trigger connection pool exhaustion and observe graceful backpressure.',
    icon: Database,
    blastRadius: 'critical',
    estimatedRecovery: '~20s',
    affectedServices: ['timescaledb', 'ingestion-service', 'api-service'],
    category: 'data',
  },
  {
    id: 'cpu-spike',
    name: 'CPU Starvation',
    description: 'Pins 3 collector agents to 95% CPU to validate that the scheduler deprioritizes background GC and maintains p99 < 200ms.',
    icon: Cpu,
    blastRadius: 'medium',
    estimatedRecovery: '~5s',
    affectedServices: ['collector-agent-01', 'collector-agent-02', 'collector-agent-03'],
    category: 'resource',
  },
  {
    id: 'cascade-failure',
    name: 'Cascade Failure',
    description: 'Kills the ml-detector service mid-window so anomaly scoring halts. Verifies that the rules engine falls back gracefully.',
    icon: Activity,
    blastRadius: 'high',
    estimatedRecovery: '~12s',
    affectedServices: ['anomaly-detector', 'api-service', 'alerting-engine'],
    category: 'cascade',
  },
  {
    id: 'schema-drift',
    name: 'Schema Drift Injection',
    description: 'Sends malformed metric payloads with missing required fields. Validates the ingestion schema validator and dead-letter queue.',
    icon: AlertTriangle,
    blastRadius: 'low',
    estimatedRecovery: '~2s',
    affectedServices: ['ingestion-service', 'dead-letter-queue'],
    category: 'data',
  },
  {
    id: 'collector-kill',
    name: 'Agent Hard Kill',
    description: 'Sends SIGKILL to a collector agent mid-batch. Tests WAL recovery and NATS re-delivery guarantees.',
    icon: Server,
    blastRadius: 'medium',
    estimatedRecovery: '~6s',
    affectedServices: ['collector-agent-01', 'nats-jetstream'],
    category: 'cascade',
  },
];

const BLAST_LEVEL_STYLE: Record<BlastLevel, { badge: string; bar: string; label: string }> = {
  low: { badge: 'bg-pulse-emerald/10 text-pulse-emerald border-pulse-emerald/20', bar: 'bg-pulse-emerald', label: 'Low' },
  medium: { badge: 'bg-pulse-sky/10 text-pulse-sky border-pulse-sky/20', bar: 'bg-pulse-sky', label: 'Medium' },
  high: { badge: 'bg-pulse-amber/10 text-pulse-amber border-pulse-amber/20', bar: 'bg-pulse-amber', label: 'High' },
  critical: { badge: 'bg-pulse-rose/10 text-pulse-rose border-pulse-rose/20', bar: 'bg-pulse-rose', label: 'Critical' },
};

const CATEGORY_COLOR: Record<ChaosScenario['category'], string> = {
  network: 'text-pulse-sky border-pulse-sky/20 bg-pulse-sky/10',
  resource: 'text-pulse-amber border-pulse-amber/20 bg-pulse-amber/10',
  data: 'text-pulse-coral border-pulse-coral/20 bg-pulse-coral/10',
  cascade: 'text-pulse-rose border-pulse-rose/20 bg-pulse-rose/10',
};

// ─── Scenario script generators ────────────────────────────────────────────

function buildTimeline(scenario: ChaosScenario): TimelineEvent[] {
  const scripts: Record<string, TimelineEvent[]> = {
    'network-partition': [
      { t: 0, msg: 'Injecting network partition — dropping NATS TCP connections', level: 'error' },
      { t: 1, msg: 'ingestion-service: connection lost to nats://localhost:4222', level: 'error' },
      { t: 2, msg: 'ingestion-service: switching to local WAL buffer (capacity 50K)', level: 'warn' },
      { t: 3, msg: 'api-service: health check degraded — NATS ping timeout 3000ms', level: 'warn' },
      { t: 5, msg: 'Buffered 4,820 metric events locally — no data loss', level: 'info' },
      { t: 10, msg: 'Partition lifted — NATS connection re-established', level: 'success' },
      { t: 11, msg: 'Flushing WAL buffer: 4,820 events replayed to JetStream', level: 'info' },
      { t: 13, msg: 'All events confirmed landed in TimescaleDB — 0 records dropped', level: 'success' },
    ],
    'db-overload': [
      { t: 0, msg: 'Starting write flood — 50K concurrent INSERT transactions', level: 'error' },
      { t: 2, msg: 'TimescaleDB: connection pool at 96/96 (exhausted)', level: 'error' },
      { t: 3, msg: 'ingestion-service: backpressure active — queuing writes', level: 'warn' },
      { t: 6, msg: 'api-service: /api/v1/metrics returning 503 — shedding load', level: 'warn' },
      { t: 10, msg: 'PgBouncer: evicting stale connections — pool pressure relieving', level: 'info' },
      { t: 15, msg: 'Write flood subsiding — pool utilization dropping', level: 'info' },
      { t: 20, msg: 'Full recovery — pool at 12/96, p99 back to 18ms', level: 'success' },
    ],
    'cpu-spike': [
      { t: 0, msg: 'Pinning collector-agent-01/02/03 to 95% CPU via busy loop', level: 'error' },
      { t: 1, msg: 'collector-agent-01: Go scheduler: goroutine starvation detected', level: 'warn' },
      { t: 2, msg: 'GC pauses elevated: 8.3ms (threshold 5ms)', level: 'warn' },
      { t: 3, msg: 'GOMAXPROCS throttling applied — background GC deprioritized', level: 'info' },
      { t: 5, msg: 'CPU load released — normalizing', level: 'success' },
    ],
    'cascade-failure': [
      { t: 0, msg: 'Sending SIGTERM to ml-detector (pid 23520)', level: 'error' },
      { t: 1, msg: 'anomaly-detector: process exited — scoring halted', level: 'error' },
      { t: 2, msg: 'api-service: anomaly endpoint returning 503', level: 'warn' },
      { t: 3, msg: 'alerting-engine: falling back to static rules (threshold mode)', level: 'warn' },
      { t: 7, msg: 'Supervisor restarting ml-detector with last-known model checkpoint', level: 'info' },
      { t: 10, msg: 'ml-detector back online — reloading isolation forest model', level: 'info' },
      { t: 12, msg: 'Full anomaly scoring restored — 0 alerts missed during window', level: 'success' },
    ],
    'schema-drift': [
      { t: 0, msg: 'Sending 500 payloads with missing `host` field', level: 'error' },
      { t: 1, msg: 'ingestion-service: schema validation failed — 500 events rejected', level: 'warn' },
      { t: 1, msg: 'Dead-letter queue: 500 events enqueued for inspection', level: 'info' },
      { t: 2, msg: 'No invalid data written to TimescaleDB — schema barrier held', level: 'success' },
    ],
    'collector-kill': [
      { t: 0, msg: 'SIGKILL → collector-agent-01 (pid 23481) — process terminated', level: 'error' },
      { t: 1, msg: 'NATS JetStream: consumer heartbeat missed — redelivery triggered', level: 'warn' },
      { t: 2, msg: 'Supervisor: spawning replacement collector-agent-01 (pid 24001)', level: 'info' },
      { t: 4, msg: 'collector-agent-01: WAL replay — recovering 320 in-flight events', level: 'info' },
      { t: 6, msg: 'All 320 events confirmed in TimescaleDB — exactly-once delivery', level: 'success' },
    ],
  };
  return scripts[scenario.id] ?? [];
}

// ─── Page ──────────────────────────────────────────────────────────────────

export const ChaosLabPage: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<ChaosScenario>(SCENARIOS[0]);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [filter, setFilter] = useState<ChaosScenario['category'] | 'all'>('all');

  const filteredScenarios = filter === 'all' ? SCENARIOS : SCENARIOS.filter((s) => s.category === filter);

  const handleRun = useCallback(() => {
    const timeline = buildTimeline(selectedScenario);
    const state: RunState = {
      scenarioId: selectedScenario.id,
      status: 'running',
      startedAt: new Date(),
      elapsed: 0,
      events: [],
      errorRate: 0,
      recoveryPct: 0,
    };
    setRunState(state);

    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      setRunState((prev) => {
        if (!prev) return null;
        const newEvents = timeline.filter((e) => e.t === tick);
        const allEvents = [...prev.events, ...newEvents];
        const maxT = timeline[timeline.length - 1]?.t ?? 10;
        const recoveryPct = Math.min(100, Math.round((tick / maxT) * 100));
        const status: ScenarioStatus =
          tick >= maxT ? 'recovered' : tick > maxT * 0.6 ? 'recovering' : 'running';

        const errRate =
          status === 'running' ? Math.min(24, tick * 3 + Math.random() * 5) :
          status === 'recovering' ? Math.max(0, 24 - (tick - maxT * 0.6) * 4) : 0;

        if (tick >= maxT) clearInterval(interval);

        return { ...prev, status, elapsed: tick, events: allEvents, recoveryPct, errorRate: parseFloat(errRate.toFixed(1)) };
      });
    }, 1000);
  }, [selectedScenario]);

  const handleStop = () => setRunState(null);

  const isRunning = runState?.status === 'running' || runState?.status === 'recovering';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pulse-rose/10 border border-pulse-rose/20 text-pulse-rose text-xs font-mono mb-2">
          <Zap className="w-3 h-3" />
          Chaos Engineering Studio
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Chaos Lab</h1>
        <p className="text-xs text-pulse-secondary mt-1 font-mono">
          Inject controlled failures. Watch the system self-heal. Generate proof.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'network', 'resource', 'data', 'cascade'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              filter === cat
                ? 'bg-pulse-coral/15 border-pulse-coral/30 text-pulse-coral'
                : 'bg-void-card border-white/10 text-pulse-secondary hover:text-white'
            }`}
          >
            {cat === 'all' ? 'All Scenarios' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
        <span className="text-[10px] text-pulse-tertiary font-mono ml-auto">{filteredScenarios.length} scenario(s)</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        {/* Scenario Grid */}
        <div className="space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-pulse-tertiary mb-1">
            Select Scenario
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredScenarios.map((sc) => {
              const bl = BLAST_LEVEL_STYLE[sc.blastRadius];
              const Icon = sc.icon;
              const isSelected = selectedScenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => { setSelectedScenario(sc); setRunState(null); }}
                  className={`text-left hud-panel rounded-xl p-4 border transition-all duration-150 ${
                    isSelected
                      ? 'border-pulse-coral/40 bg-pulse-coral/5 shadow-lg shadow-pulse-coral/10'
                      : 'border-white/[0.07] hover:border-white/20 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-pulse-coral/20' : 'bg-white/5'
                    }`}>
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-pulse-coral' : 'text-pulse-secondary'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold font-mono text-white truncate">{sc.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[sc.category]}`}>
                          {sc.category}
                        </span>
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${bl.badge}`}>
                          {bl.label} blast
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-pulse-secondary leading-relaxed mb-3">{sc.description}</p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-pulse-tertiary">
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Recovery: {sc.estimatedRecovery}</span>
                    <span>{sc.affectedServices.length} services</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Run Panel */}
        <div className="space-y-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-pulse-tertiary mb-1">
            Execution Panel
          </div>

          {/* Selected Scenario Info */}
          <div className="hud-panel rounded-xl p-5 border border-white/[0.07] space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold font-mono text-white">{selectedScenario.name}</div>
                <div className={`mt-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border inline-flex ${BLAST_LEVEL_STYLE[selectedScenario.blastRadius].badge}`}>
                  {BLAST_LEVEL_STYLE[selectedScenario.blastRadius].label} blast radius
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-pulse-tertiary font-mono">Est. Recovery</div>
                <div className="text-sm font-bold font-mono text-pulse-emerald">{selectedScenario.estimatedRecovery}</div>
              </div>
            </div>

            {/* Affected Services */}
            <div>
              <div className="text-[10px] font-mono text-pulse-tertiary uppercase tracking-wide mb-1.5">Affected Services</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedScenario.affectedServices.map((s) => (
                  <span key={s} className="text-[10px] font-mono px-2 py-0.5 rounded bg-pulse-rose/10 border border-pulse-rose/20 text-pulse-rose">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Blast Radius Bar */}
            <div>
              <div className="text-[10px] font-mono text-pulse-tertiary uppercase tracking-wide mb-1.5">Blast Radius</div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${BLAST_LEVEL_STYLE[selectedScenario.blastRadius].bar}`}
                  style={{ width: selectedScenario.blastRadius === 'low' ? '20%' : selectedScenario.blastRadius === 'medium' ? '50%' : selectedScenario.blastRadius === 'high' ? '75%' : '100%' }}
                />
              </div>
            </div>

            {/* Run Button */}
            {!isRunning ? (
              <button
                onClick={handleRun}
                className="w-full py-3 rounded-xl bg-pulse-rose hover:bg-pulse-rose/80 text-white font-bold text-sm font-mono transition-all flex items-center justify-center gap-2 shadow-lg shadow-pulse-rose/20"
              >
                <Play className="w-4 h-4" />
                Inject Chaos
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="w-full py-3 rounded-xl bg-void-card hover:bg-void-elevated border border-white/10 text-pulse-secondary font-bold text-sm font-mono transition-all flex items-center justify-center gap-2"
              >
                <StopCircle className="w-4 h-4" />
                Abort Scenario
              </button>
            )}
          </div>

          {/* Live Recovery Panel */}
          {runState && (
            <div className="hud-panel rounded-xl p-5 border border-white/[0.07] space-y-4">
              {/* Status Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {runState.status === 'running' && <span className="w-2 h-2 rounded-full bg-pulse-rose animate-pulse" />}
                  {runState.status === 'recovering' && <span className="w-2 h-2 rounded-full bg-pulse-amber animate-pulse" />}
                  {runState.status === 'recovered' && <CheckCircle2 className="w-4 h-4 text-pulse-emerald" />}
                  <span className={`text-xs font-bold font-mono ${
                    runState.status === 'recovered' ? 'text-pulse-emerald' :
                    runState.status === 'recovering' ? 'text-pulse-amber' : 'text-pulse-rose'
                  }`}>
                    {runState.status.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs font-mono text-pulse-tertiary">+{runState.elapsed}s</span>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-void border border-white/5 text-center">
                  <div className={`text-lg font-bold font-mono ${runState.errorRate > 5 ? 'text-pulse-rose' : runState.errorRate > 0 ? 'text-pulse-amber' : 'text-pulse-emerald'}`}>
                    {runState.errorRate}%
                  </div>
                  <div className="text-[10px] text-pulse-tertiary font-mono">Error Rate</div>
                </div>
                <div className="p-3 rounded-lg bg-void border border-white/5 text-center">
                  <div className={`text-lg font-bold font-mono ${runState.recoveryPct === 100 ? 'text-pulse-emerald' : 'text-pulse-sky'}`}>
                    {runState.recoveryPct}%
                  </div>
                  <div className="text-[10px] text-pulse-tertiary font-mono">Recovery</div>
                </div>
              </div>

              {/* Recovery Progress Bar */}
              <div>
                <div className="text-[10px] font-mono text-pulse-tertiary uppercase tracking-wide mb-1.5">Recovery Progress</div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      runState.status === 'recovered' ? 'bg-pulse-emerald' :
                      runState.status === 'recovering' ? 'bg-pulse-amber' : 'bg-pulse-rose'
                    }`}
                    style={{ width: `${runState.recoveryPct}%` }}
                  />
                </div>
              </div>

              {/* Timeline */}
              <div>
                <div className="text-[10px] font-mono text-pulse-tertiary uppercase tracking-wide mb-2">Live Timeline</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {runState.events.length === 0 && (
                    <div className="text-[11px] font-mono text-pulse-tertiary animate-pulse">Initializing scenario...</div>
                  )}
                  {[...runState.events].reverse().map((evt, i) => {
                    const colors = { info: 'text-pulse-sky', warn: 'text-pulse-amber', error: 'text-pulse-rose', success: 'text-pulse-emerald' };
                    const dots = { info: 'bg-pulse-sky', warn: 'bg-pulse-amber', error: 'bg-pulse-rose', success: 'bg-pulse-emerald' };
                    return (
                      <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${dots[evt.level]}`} />
                        <span className="text-pulse-tertiary shrink-0 w-8">+{evt.t}s</span>
                        <span className={colors[evt.level]}>{evt.msg}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {runState.status === 'recovered' && (
                <div className="p-3 rounded-xl bg-pulse-emerald/10 border border-pulse-emerald/20 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-pulse-emerald shrink-0" />
                  <div className="text-xs font-mono text-pulse-emerald">
                    <span className="font-bold">System recovered.</span> All events confirmed. 0 records dropped.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
