import React, { useState, useEffect } from 'react';
import { Bot, Database, Radio, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  borderClass: string;
  badgeClass: string;
  stat: string;
  status: 'active' | 'warning' | 'verified';
  detail: string;
}

const STAGES: PipelineStage[] = [
  {
    id: 'agent',
    name: 'Agent Process',
    subtitle: 'Go / Python SDK',
    icon: Bot,
    color: 'text-pulse-coral',
    borderClass: 'border-pulse-coral/40 shadow-pulse-glow',
    badgeClass: 'bg-pulse-coral/10 text-pulse-coral border-pulse-coral/30',
    stat: 'Emit Write: ckpt_4a1',
    status: 'active',
    detail: 'Autonomous agent claims task completed and orders record committed.',
  },
  {
    id: 'nats',
    name: 'NATS JetStream',
    subtitle: 'Durable Ring Buffer',
    icon: Radio,
    color: 'text-neon-sky',
    borderClass: 'border-neon-sky/40 shadow-pulse-cyan',
    badgeClass: 'bg-neon-sky/10 text-neon-sky border-neon-sky/30',
    stat: '2,040 pts/s (<0.5ms)',
    status: 'active',
    detail: 'Sub-millisecond durable message stream with zero loss fallback.',
  },
  {
    id: 'tsdb',
    name: 'TimescaleDB',
    subtitle: 'Hypertable Storage',
    icon: Database,
    color: 'text-neon-emerald',
    borderClass: 'border-neon-emerald/40 glow-emerald',
    badgeClass: 'bg-neon-emerald/10 text-neon-emerald border-neon-emerald/30',
    stat: 'Hypertable Verify: PASS',
    status: 'verified',
    detail: 'Actual disk verification: checks table chunks to prove row landed.',
  },
  {
    id: 'verifier',
    name: 'PulseWatch Engine',
    subtitle: 'Ground-Truth Auditor',
    icon: ShieldCheck,
    color: 'text-neon-amber',
    borderClass: 'border-neon-amber/40 shadow-sm',
    badgeClass: 'bg-neon-amber/10 text-neon-amber border-neon-amber/30',
    stat: '0 Silent Failures',
    status: 'verified',
    detail: 'Continuously proves zero silent failure rate with self-healing checkpoints.',
  },
];

const SIMULATED_STREAM = [
  { time: '0.1s', event: 'agent.order_placed', target: 'orders_hypertable', status: 'verified', latency: '0.8ms' },
  { time: '0.4s', event: 'billing_agent.invoice', target: 'invoices_hypertable', status: 'verified', latency: '1.2ms' },
  { time: '0.9s', event: 'auth.session_token', target: 'auth_audit_log', status: 'verified', latency: '0.6ms' },
  { time: '1.3s', event: 'collector.cpu_metric', target: 'metrics_raw', status: 'verified', latency: '0.4ms' },
];

export const HeroPipelineVisual: React.FC<{ onExploreDashboard: () => void }> = ({ onExploreDashboard }) => {
  const [selectedStage, setSelectedStage] = useState<string>('verifier');
  const [simulatedFailure, setSimulatedFailure] = useState<boolean>(false);
  const [streamIndex, setStreamIndex] = useState<number>(0);

  // Cycle simulated stream items
  useEffect(() => {
    const timer = setInterval(() => {
      setStreamIndex((prev) => (prev + 1) % SIMULATED_STREAM.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const handleTestSilentCatch = () => {
    setSimulatedFailure(true);
    setTimeout(() => {
      setSimulatedFailure(false);
    }, 4500);
  };

  const currentStage = STAGES.find((s) => s.id === selectedStage) || STAGES[3];
  const streamEvent = SIMULATED_STREAM[streamIndex];

  return (
    <div className="relative rounded-3xl p-6 sm:p-8 bg-void-card/90 border border-white/[0.12] shadow-2xl backdrop-blur-2xl overflow-hidden text-left max-w-5xl mx-auto">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-pulse-coral/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-neon-sky/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/[0.08] relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-neon-rose/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-neon-amber/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-neon-emerald/80 inline-block" />
          </div>
          <span className="text-xs font-mono text-pulse-tertiary">|</span>
          <span className="text-xs font-mono font-semibold text-white tracking-wide flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-pulse-coral" />
            Live Ground-Truth Verification Pipeline
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full bg-neon-emerald/10 border border-neon-emerald/20 text-[11px] font-mono text-neon-emerald flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-emerald animate-ping" />
            Telemetry Verified · 0 Drops
          </span>
          <button
            onClick={handleTestSilentCatch}
            disabled={simulatedFailure}
            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-pulse-secondary hover:text-white transition-colors flex items-center gap-1.5"
          >
            {simulatedFailure ? (
              <>
                <RefreshCw className="w-3 h-3 text-neon-amber animate-spin" />
                <span className="text-neon-amber">Recovering...</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-pulse-coral" />
                <span>Simulate Silent Failure</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Simulated Silent Failure Notification Banner */}
      {simulatedFailure && (
        <div className="my-4 p-3.5 rounded-xl bg-neon-amber/10 border border-neon-amber/30 text-xs font-mono text-white flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-neon-amber shrink-0 animate-pulse" />
            <span>
              <strong>[SILENT FAILURE INJECTED]</strong> Agent claimed row saved, but TimescaleDB hypertable query returned 0 rows!
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-neon-emerald/20 text-neon-emerald border border-neon-emerald/30 font-bold shrink-0">
            ✓ Auto-Resumed from ckpt_4a1
          </span>
        </div>
      )}

      {/* Interactive 4-Node Pipeline Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6 relative z-10">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isSelected = selectedStage === stage.id;
          return (
            <div
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`relative cursor-pointer p-4 rounded-2xl border transition-all duration-300 ${
                isSelected
                  ? `${stage.borderClass} bg-void-elevated ring-1 ring-white/20`
                  : 'border-white/[0.08] bg-void/60 hover:bg-void-elevated hover:border-white/20'
              }`}
            >
              {/* Connector Arrow for desktop */}
              {idx < STAGES.length - 1 && (
                <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-20 pointer-events-none text-pulse-tertiary">
                  <span className="text-xs font-mono">→</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 ${stage.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${stage.badgeClass}`}>
                  {stage.status}
                </span>
              </div>

              <div className="font-mono text-sm font-bold text-white mb-0.5">{stage.name}</div>
              <div className="text-[11px] text-pulse-tertiary font-mono mb-3">{stage.subtitle}</div>

              <div className="text-xs font-mono px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5 text-white/90 truncate">
                {stage.stat}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage Detail Callout */}
      <div className="p-4 rounded-2xl bg-void border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-pulse-tertiary">Active Inspector:</span>
            <span className={`text-xs font-mono font-bold ${currentStage.color}`}>{currentStage.name}</span>
          </div>
          <p className="text-xs text-pulse-secondary leading-relaxed font-sans max-w-2xl">
            {currentStage.detail}
          </p>
        </div>

        <button
          onClick={onExploreDashboard}
          className="px-4 py-2 rounded-xl bg-pulse-coral hover:bg-pulse-coral-hover text-white text-xs font-mono font-semibold transition-all shadow-pulse-glow flex items-center justify-center gap-2 shrink-0 group"
        >
          <span>Launch Mission Control</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </button>
      </div>

      {/* Real-time Ticker Footer */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-pulse-tertiary">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-pulse-coral animate-ping shrink-0" />
          <span className="text-pulse-secondary">Event Ticker:</span>
          <span className="text-white truncate font-medium">+{streamEvent.time} · {streamEvent.event}</span>
          <span className="text-neon-emerald">({streamEvent.latency})</span>
          <span className="hidden sm:inline text-pulse-tertiary">→ {streamEvent.target}</span>
        </div>
        <span className="text-neon-emerald shrink-0 hidden sm:flex items-center gap-1 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Hypertable Verified
        </span>
      </div>
    </div>
  );
};
