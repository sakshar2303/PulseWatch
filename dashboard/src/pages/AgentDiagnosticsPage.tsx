import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  RefreshCw, TrendingUp, TrendingDown,Clock,
  GitBranch, Layers, Server, AlertTriangle,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AgentMetric {
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  health: 'ok' | 'warn' | 'critical';
}

interface AgentProcess {
  id: string;
  name: string;
  service: string;
  pid: number;
  uptime: string;
  status: 'healthy' | 'degraded' | 'critical' | 'idle';
  metrics: {
    cpu: AgentMetric;
    memory: AgentMetric;
    goroutines: AgentMetric;
    gcPause: AgentMetric;
    requestRate: AgentMetric;
    errorRate: AgentMetric;
    p99: AgentMetric;
    openConns: AgentMetric;
  };
  sparklines: {
    cpu: number[];
    memory: number[];
    requestRate: number[];
  };
  recentEvents: { time: string; msg: string; level: 'info' | 'warn' | 'error' }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function randBetween(lo: number, hi: number, decimals = 1) {
  const v = lo + Math.random() * (hi - lo);
  return parseFloat(v.toFixed(decimals));
}

function generateSparkline(base: number, range: number, len = 24): number[] {
  let v = base;
  return Array.from({ length: len }, () => {
    v += (Math.random() - 0.48) * range;
    v = Math.max(base * 0.5, Math.min(base * 1.6, v));
    return parseFloat(v.toFixed(1));
  });
}

function makeAgent(
  id: string, name: string, service: string, pid: number, uptime: string,
  status: AgentProcess['status'], cpuBase: number, memBase: number,
): AgentProcess {
  const errRate = status === 'critical' ? randBetween(2, 8) : status === 'degraded' ? randBetween(0.5, 2) : randBetween(0, 0.4);
  return {
    id, name, service, pid, uptime, status,
    metrics: {
      cpu: { value: cpuBase, unit: '%', trend: 'stable', health: cpuBase > 70 ? 'warn' : 'ok' },
      memory: { value: memBase, unit: 'MB', trend: 'stable', health: memBase > 400 ? 'warn' : 'ok' },
      goroutines: { value: randBetween(120, 480, 0), unit: '', trend: 'stable', health: 'ok' },
      gcPause: { value: randBetween(0.3, 3.8), unit: 'ms', trend: 'stable', health: 'ok' },
      requestRate: { value: randBetween(80, 2200, 0), unit: '/s', trend: 'up', health: 'ok' },
      errorRate: { value: errRate, unit: '%', trend: errRate > 1 ? 'up' : 'stable', health: errRate > 1 ? 'warn' : 'ok' },
      p99: { value: randBetween(12, 180), unit: 'ms', trend: 'stable', health: 'ok' },
      openConns: { value: randBetween(8, 96, 0), unit: '', trend: 'stable', health: 'ok' },
    },
    sparklines: {
      cpu: generateSparkline(cpuBase, 8),
      memory: generateSparkline(memBase, 30),
      requestRate: generateSparkline(randBetween(200, 1800, 0), 200),
    },
    recentEvents: status === 'critical'
      ? [
          { time: '0s ago', msg: 'GC pause spike 14.2 ms', level: 'error' },
          { time: '3s ago', msg: 'Connection pool exhausted (96/96)', level: 'error' },
          { time: '11s ago', msg: 'Request queue depth > 5000', level: 'warn' },
        ]
      : status === 'degraded'
      ? [
          { time: '2s ago', msg: 'Goroutine count elevated (440)', level: 'warn' },
          { time: '18s ago', msg: 'P99 latency spiked to 165ms', level: 'warn' },
        ]
      : [
          { time: '4s ago', msg: 'Checkpoint write landed in 3.2ms', level: 'info' },
          { time: '12s ago', msg: 'GC cycle completed — 0.7ms pause', level: 'info' },
        ],
  };
}

const INITIAL_AGENTS: AgentProcess[] = [
  makeAgent('ag-001', 'collector-agent-01', 'telemetry-collector', 23481, '4d 12h 7m', 'healthy', 18.4, 142),
  makeAgent('ag-002', 'ingestion-worker-01', 'ingestion-service', 23502, '4d 12h 5m', 'healthy', 24.1, 218),
  makeAgent('ag-003', 'ingestion-worker-02', 'ingestion-service', 23503, '4d 12h 5m', 'degraded', 58.7, 381),
  makeAgent('ag-004', 'api-gateway-01', 'api-service', 23510, '4d 12h 3m', 'healthy', 12.3, 96),
  makeAgent('ag-005', 'ml-detector-01', 'anomaly-detector', 23520, '3d 6h 22m', 'healthy', 31.5, 512),
  makeAgent('ag-006', 'chaos-injector', 'chaos-engine', 23530, '0d 0h 14m', 'critical', 79.2, 448),
];

// ─── Sparkline SVG ─────────────────────────────────────────────────────────

function Sparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 120;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />
      <polyline
        points={`0,${height} ${pts} ${w},${height}`}
        fill={color} fillOpacity="0.08" stroke="none"
      />
    </svg>
  );
}

// ─── Mini Metric Cell ──────────────────────────────────────────────────────

function MetricCell({ label, metric }: { label: string; metric: AgentMetric }) {
  const healthColor = metric.health === 'critical' ? 'text-pulse-rose' : metric.health === 'warn' ? 'text-pulse-amber' : 'text-pulse-emerald';
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono text-pulse-tertiary uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-sm font-bold font-mono ${healthColor}`}>{metric.value}</span>
        <span className="text-[10px] text-pulse-tertiary">{metric.unit}</span>
        {TrendIcon && <TrendIcon className={`w-3 h-3 ${metric.trend === 'up' && metric.health !== 'ok' ? 'text-pulse-amber' : 'text-pulse-tertiary'}`} />}
      </div>
    </div>
  );
}

// ─── Agent Card ────────────────────────────────────────────────────────────

function AgentCard({ agent, isSelected, onClick }: { agent: AgentProcess; isSelected: boolean; onClick: () => void }) {
  const statusStyles: Record<AgentProcess['status'], { border: string; badge: string; dot: string }> = {
    healthy: { border: 'border-pulse-emerald/20', badge: 'bg-pulse-emerald/10 text-pulse-emerald border-pulse-emerald/20', dot: 'bg-pulse-emerald' },
    degraded: { border: 'border-pulse-amber/25', badge: 'bg-pulse-amber/10 text-pulse-amber border-pulse-amber/20', dot: 'bg-pulse-amber' },
    critical: { border: 'border-pulse-rose/30', badge: 'bg-pulse-rose/10 text-pulse-rose border-pulse-rose/20', dot: 'bg-pulse-rose' },
    idle: { border: 'border-white/10', badge: 'bg-white/5 text-pulse-secondary border-white/10', dot: 'bg-pulse-secondary' },
  };
  const sc = statusStyles[agent.status];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left hud-panel rounded-xl p-4 border transition-all duration-200 ${
        isSelected
          ? 'border-pulse-coral/40 bg-pulse-coral/5 shadow-lg shadow-pulse-coral/10'
          : `${sc.border} hover:border-pulse-coral/25 hover:bg-white/[0.02]`
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-xs font-bold font-mono text-white">{agent.name}</div>
          <div className="text-[10px] text-pulse-tertiary font-mono mt-0.5">{agent.service} · PID {agent.pid}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase ${sc.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${agent.status === 'critical' ? 'animate-pulse' : ''}`} />
          {agent.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
        <MetricCell label="CPU" metric={agent.metrics.cpu} />
        <MetricCell label="Memory" metric={agent.metrics.memory} />
        <MetricCell label="Goroutines" metric={agent.metrics.goroutines} />
        <MetricCell label="Err Rate" metric={agent.metrics.errorRate} />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
        <span className="text-[10px] font-mono text-pulse-tertiary flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> {agent.uptime}
        </span>
        <Sparkline data={agent.sparklines.cpu} color="#e86a38" height={20} />
      </div>
    </button>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────────────────

function AgentDetailPanel({ agent }: { agent: AgentProcess }) {
  const statusLabels: Record<AgentProcess['status'], { color: string; label: string }> = {
    healthy: { color: 'text-pulse-emerald', label: 'Healthy' },
    degraded: { color: 'text-pulse-amber', label: 'Degraded' },
    critical: { color: 'text-pulse-rose', label: 'Critical' },
    idle: { color: 'text-pulse-secondary', label: 'Idle' },
  };
  const sl = statusLabels[agent.status];
  return (
    <div className="space-y-5">
      <div className="hud-panel rounded-xl p-5 border border-white/[0.07]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-lg font-bold font-mono text-white">{agent.name}</div>
            <div className="text-xs text-pulse-secondary mt-0.5">{agent.service} · PID {agent.pid}</div>
          </div>
          <span className={`text-sm font-bold font-mono ${sl.color}`}>{sl.label}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCell label="CPU Usage" metric={agent.metrics.cpu} />
          <MetricCell label="Memory" metric={agent.metrics.memory} />
          <MetricCell label="Goroutines" metric={agent.metrics.goroutines} />
          <MetricCell label="GC Pause" metric={agent.metrics.gcPause} />
          <MetricCell label="Req Rate" metric={agent.metrics.requestRate} />
          <MetricCell label="Error Rate" metric={agent.metrics.errorRate} />
          <MetricCell label="P99 Latency" metric={agent.metrics.p99} />
          <MetricCell label="Open Conns" metric={agent.metrics.openConns} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'CPU Trend', key: 'cpu' as const, color: '#e86a38' },
          { label: 'Memory Trend', key: 'memory' as const, color: '#6ea8fe' },
          { label: 'Request Rate', key: 'requestRate' as const, color: '#34d399' },
        ]).map(({ label, key, color }) => (
          <div key={key} className="hud-panel rounded-xl p-4 border border-white/[0.07]">
            <div className="text-[10px] font-mono text-pulse-tertiary uppercase tracking-wide mb-2">{label}</div>
            <Sparkline data={agent.sparklines[key]} color={color} height={48} />
          </div>
        ))}
      </div>
      <div className="hud-panel rounded-xl p-5 border border-white/[0.07]">
        <div className="text-xs font-mono text-pulse-secondary uppercase tracking-wider mb-3">Recent Process Events</div>
        <div className="space-y-2">
          {agent.recentEvents.map((evt, i) => {
            const lvlColors = { info: 'text-pulse-sky', warn: 'text-pulse-amber', error: 'text-pulse-rose' };
            const lvlDot = { info: 'bg-pulse-sky', warn: 'bg-pulse-amber', error: 'bg-pulse-rose' };
            return (
              <div key={i} className="flex items-start gap-2.5 text-xs font-mono">
                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${lvlDot[evt.level]}`} />
                <span className="text-pulse-tertiary shrink-0 w-14">{evt.time}</span>
                <span className={lvlColors[evt.level]}>{evt.msg}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export const AgentDiagnosticsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentProcess[]>(INITIAL_AGENTS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_AGENTS[0].id);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = () => {
    setAgents((prev) =>
      prev.map((ag) => ({
        ...ag,
        metrics: {
          ...ag.metrics,
          cpu: { ...ag.metrics.cpu, value: parseFloat((Math.max(1, ag.metrics.cpu.value + (Math.random() - 0.48) * 4)).toFixed(1)) },
          goroutines: { ...ag.metrics.goroutines, value: Math.max(50, ag.metrics.goroutines.value + Math.floor((Math.random() - 0.5) * 20)) },
          errorRate: { ...ag.metrics.errorRate, value: parseFloat((Math.max(0, ag.metrics.errorRate.value + (Math.random() - 0.48) * 0.3)).toFixed(2)) },
        },
        sparklines: {
          ...ag.sparklines,
          cpu: [...ag.sparklines.cpu.slice(1), parseFloat((Math.max(1, ag.metrics.cpu.value + (Math.random() - 0.5) * 5)).toFixed(1))],
        },
      }))
    );
    setLastRefresh(new Date());
  };

  useEffect(() => {
    intervalRef.current = setInterval(refresh, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = agents.find((a) => a.id === selectedId) ?? agents[0];
  const healthSummary = {
    healthy: agents.filter((a) => a.status === 'healthy').length,
    degraded: agents.filter((a) => a.status === 'degraded').length,
    critical: agents.filter((a) => a.status === 'critical').length,
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pulse-sky/10 border border-pulse-sky/20 text-pulse-sky text-xs font-mono mb-2">
            <Layers className="w-3 h-3" />
            Process-Level Diagnostics
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Agent Diagnostics</h1>
          <p className="text-xs text-pulse-secondary mt-1 font-mono">
            Real-time goroutine, GC, and memory telemetry per agent process
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-1 rounded-lg bg-pulse-emerald/10 border border-pulse-emerald/20 text-pulse-emerald text-xs font-mono">
              {healthSummary.healthy} healthy
            </span>
            {healthSummary.degraded > 0 && (
              <span className="px-2 py-1 rounded-lg bg-pulse-amber/10 border border-pulse-amber/20 text-pulse-amber text-xs font-mono">
                {healthSummary.degraded} degraded
              </span>
            )}
            {healthSummary.critical > 0 && (
              <span className="px-2 py-1 rounded-lg bg-pulse-rose/10 border border-pulse-rose/20 text-pulse-rose text-xs font-mono animate-pulse">
                {healthSummary.critical} critical
              </span>
            )}
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-lg bg-void-card hover:bg-void-elevated border border-white/10 text-pulse-secondary hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="text-[10px] font-mono text-pulse-tertiary -mt-2">
        Last polled: {lastRefresh.toLocaleTimeString()} · auto-refreshes every 3s
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Agents', value: agents.length, icon: Server, color: 'text-white' },
          { label: 'Avg CPU', value: `${(agents.reduce((s, a) => s + a.metrics.cpu.value, 0) / agents.length).toFixed(1)}%`, icon: Cpu, color: 'text-pulse-coral' },
          { label: 'Total Goroutines', value: agents.reduce((s, a) => s + a.metrics.goroutines.value, 0), icon: GitBranch, color: 'text-pulse-sky' },
          { label: 'Avg Error Rate', value: `${(agents.reduce((s, a) => s + a.metrics.errorRate.value, 0) / agents.length).toFixed(2)}%`, icon: AlertTriangle, color: 'text-pulse-amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="hud-panel rounded-xl p-4 border border-white/[0.07] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <div className={`text-base font-bold font-mono ${color}`}>{value}</div>
              <div className="text-[10px] text-pulse-tertiary">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <div className="space-y-2.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-pulse-tertiary px-1 mb-3">
            Processes ({agents.length})
          </div>
          {agents.map((ag) => (
            <AgentCard key={ag.id} agent={ag} isSelected={ag.id === selectedId} onClick={() => setSelectedId(ag.id)} />
          ))}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-pulse-tertiary px-1 mb-3">
            Detail — {selected.name}
          </div>
          <AgentDetailPanel agent={selected} />
        </div>
      </div>
    </div>
  );
};
