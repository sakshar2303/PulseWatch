import React from 'react';
import { ArrowRight, ShieldCheck, Cpu, Radio, CheckCircle2, ExternalLink, Zap } from 'lucide-react';
import { ActivePage } from '../components/layout/Sidebar';

interface WelcomePageProps {
  onNavigate: (page: ActivePage) => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-16 pb-20 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="relative pt-8 pb-12 text-center overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-omium-coral/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[350px] h-[200px] bg-omium-sky/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-void-card border border-white/10 text-xs font-mono text-omium-secondary shadow-omium-card">
            <span className="w-2 h-2 rounded-full bg-omium-coral animate-ping" />
            <span className="text-white font-medium">PulseWatch 1.0</span>
            <span className="text-omium-tertiary">·</span>
            <span className="text-omium-coral">Omium-Powered Ground-Truth Observability</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
            Your agent reported success.{' '}
            <span className="bg-gradient-to-r from-omium-coral via-omium-coral-hover to-omium-sky bg-clip-text text-transparent">
              The row was never written.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-omium-secondary leading-relaxed max-w-2xl mx-auto font-sans">
            Tracing logs what your services claim they did. PulseWatch opens your database to verify the row actually landed, and triggers counterfactual replay for writes that failed.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={() => onNavigate('overview')}
              className="px-5 py-3 rounded-xl bg-omium-coral hover:bg-omium-coral-hover text-white font-semibold text-sm transition-all shadow-omium-glow flex items-center gap-2 group"
            >
              <span>Launch Mission Control</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigate('audit')}
              className="px-5 py-3 rounded-xl bg-void-card hover:bg-void-elevated border border-white/10 text-white font-semibold text-sm transition-all flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-omium-emerald" />
              <span>View Silent Failure Audit</span>
            </button>

            <button
              onClick={() => onNavigate('topology')}
              className="px-4 py-3 rounded-xl bg-void hover:bg-void-card border border-white/5 text-omium-secondary hover:text-white font-mono text-xs transition-colors"
            >
              <span>Explore Architecture Topology →</span>
            </button>
          </div>

          {/* Supported Frameworks Tagline */}
          <div className="pt-6 text-xs font-mono text-omium-tertiary flex flex-wrap items-center justify-center gap-2">
            <span>Integrates with:</span>
            {['Go Services', 'LangChain', 'LangGraph', 'CrewAI', 'FastAPI', 'OpenTelemetry'].map((tech) => (
              <span key={tech} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-omium-secondary">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Step Verification Grid */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            From Silent Failure to Proof in Four Steps
          </h2>
          <p className="text-xs text-omium-secondary mt-1">
            Our SDK sits beside your microservices and agents without modifying business logic.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-coral/30 transition-all">
            <div className="text-2xl font-mono font-bold text-omium-coral mb-3">01</div>
            <h3 className="text-sm font-bold text-white font-mono mb-1">Connect</h3>
            <p className="text-xs text-omium-secondary leading-relaxed">
              Drop our OpenTelemetry SDK into your Go or Python service with standard W3C traceparent propagation.
            </p>
          </div>

          <div className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-sky/30 transition-all">
            <div className="text-2xl font-mono font-bold text-omium-sky mb-3">02</div>
            <h3 className="text-sm font-bold text-white font-mono mb-1">Detect</h3>
            <p className="text-xs text-omium-secondary leading-relaxed">
              We replay the execution with variations to isolate the breaking step, tool timeout, or schema mismatch.
            </p>
          </div>

          <div className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-emerald/30 transition-all">
            <div className="text-2xl font-mono font-bold text-omium-emerald mb-3">03</div>
            <h3 className="text-sm font-bold text-white font-mono mb-1">Verify</h3>
            <p className="text-xs text-omium-secondary leading-relaxed">
              We query TimescaleDB to check that the row landed. If missing, self-repair triggers from the last checkpoint.
            </p>
          </div>

          <div className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-amber/30 transition-all">
            <div className="text-2xl font-mono font-bold text-omium-amber mb-3">04</div>
            <h3 className="text-sm font-bold text-white font-mono mb-1">Prove</h3>
            <p className="text-xs text-omium-secondary leading-relaxed">
              Continuous reliability proof comparing your active failure rate against your historical baseline.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Live Swarm Checkpoints Card */}
        <div
          onClick={() => onNavigate('checkpoints')}
          className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-coral/40 cursor-pointer transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-omium-coral/15 border border-omium-coral/30 flex items-center justify-center text-omium-coral mb-4 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
            <span>Live Checkpoint Stream</span>
            <span className="text-xs text-omium-coral font-sans">Open →</span>
          </h3>
          <p className="text-xs text-omium-secondary leading-relaxed mb-4">
            Watch real-time checkpoint transitions, schema validations, and counterfactual recovery loops.
          </p>
          <div className="p-3 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-omium-tertiary">
            <span className="text-omium-coral font-bold">r_9af2</span> · supportAgent · <span className="text-omium-emerald">✓ Verified</span>
          </div>
        </div>

        {/* SLO Reliability Card */}
        <div
          onClick={() => onNavigate('slo')}
          className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-emerald/40 cursor-pointer transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-omium-emerald/15 border border-omium-emerald/30 flex items-center justify-center text-omium-emerald mb-4 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
            <span>SLO Compliance & Budget</span>
            <span className="text-xs text-omium-emerald font-sans">Open →</span>
          </h3>
          <p className="text-xs text-omium-secondary leading-relaxed mb-4">
            Google SRE methodology tracking 99.9% availability, p99 latency ceilings, and real-time burn rate.
          </p>
          <div className="p-3 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-omium-tertiary flex items-center justify-between">
            <span className="text-white">Availability: 99.98%</span>
            <span className="text-omium-emerald font-bold">MET</span>
          </div>
        </div>

        {/* Architecture Topology Card */}
        <div
          onClick={() => onNavigate('topology')}
          className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-sky/40 cursor-pointer transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-omium-sky/15 border border-omium-sky/30 flex items-center justify-center text-omium-sky mb-4 group-hover:scale-105 transition-transform">
            <Radio className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
            <span>Architecture Topology</span>
            <span className="text-xs text-omium-sky font-sans">Open →</span>
          </h3>
          <p className="text-xs text-omium-secondary leading-relaxed mb-4">
            Inspect dataflow throughput (2,040 pts/s), JetStream queues, and TimescaleDB hypertables.
          </p>
          <div className="p-3 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-omium-tertiary flex items-center justify-between">
            <span className="text-white">Pipeline Loss: 0.00%</span>
            <span className="text-omium-sky font-bold">ACTIVE</span>
          </div>
        </div>

        {/* Agent Diagnostics Card */}
        <div
          onClick={() => onNavigate('diagnostics')}
          className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-amber/40 cursor-pointer transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-omium-amber/15 border border-omium-amber/30 flex items-center justify-center text-omium-amber mb-4 group-hover:scale-105 transition-transform">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
            <span>Agent Diagnostics</span>
            <span className="text-xs text-omium-amber font-sans">Open →</span>
          </h3>
          <p className="text-xs text-omium-secondary leading-relaxed mb-4">
            Process-level goroutine tracking, GC pause metrics, and per-agent CPU/memory sparklines.
          </p>
          <div className="p-3 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-omium-tertiary flex items-center justify-between">
            <span className="text-white">6 agents · 0 critical</span>
            <span className="text-omium-amber font-bold">NEW</span>
          </div>
        </div>

        {/* Chaos Lab Card */}
        <div
          onClick={() => onNavigate('chaos')}
          className="hud-panel rounded-2xl p-6 border border-white/[0.08] bg-void-card hover:border-omium-rose/40 cursor-pointer transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-omium-rose/15 border border-omium-rose/30 flex items-center justify-center text-omium-rose mb-4 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
            <span>Chaos Lab</span>
            <span className="text-xs text-omium-rose font-sans">Open →</span>
          </h3>
          <p className="text-xs text-omium-secondary leading-relaxed mb-4">
            Inject network partitions, DB saturation, and cascade failures. Watch self-healing in real time.
          </p>
          <div className="p-3 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-omium-tertiary flex items-center justify-between">
            <span className="text-white">6 scenarios ready</span>
            <span className="text-omium-rose font-bold">LAB</span>
          </div>
        </div>
      </div>

      {/* Production Tech Stack Showcase */}
      <div className="hud-panel rounded-2xl p-8 border border-white/[0.08] bg-void-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white font-mono">
              Engineered with High-Throughput Cloud-Native Tech
            </h3>
            <p className="text-xs text-omium-secondary mt-1">
              Zero compromises on reliability, speed, and real-world scalability.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="http://localhost:16686"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-void hover:bg-void-elevated border border-white/10 text-xs font-mono text-omium-sky flex items-center gap-1.5 transition-colors"
            >
              <span>Jaeger Traces</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="p-3.5 rounded-xl bg-void border border-white/5">
            <div className="font-bold text-white font-mono text-xs">Go (1.22)</div>
            <div className="text-[10px] text-omium-tertiary mt-0.5">Collector & Ingestion</div>
          </div>
          <div className="p-3.5 rounded-xl bg-void border border-white/5">
            <div className="font-bold text-omium-emerald font-mono text-xs">TimescaleDB</div>
            <div className="text-[10px] text-omium-tertiary mt-0.5">Hypertable Storage</div>
          </div>
          <div className="p-3.5 rounded-xl bg-void border border-white/5">
            <div className="font-bold text-omium-sky font-mono text-xs">NATS JetStream</div>
            <div className="text-[10px] text-omium-tertiary mt-0.5">Durable Queue</div>
          </div>
          <div className="p-3.5 rounded-xl bg-void border border-white/5">
            <div className="font-bold text-omium-amber font-mono text-xs">Python ML</div>
            <div className="text-[10px] text-omium-tertiary mt-0.5">Isolation Forest</div>
          </div>
          <div className="p-3.5 rounded-xl bg-void border border-white/5">
            <div className="font-bold text-omium-coral font-mono text-xs">OpenTelemetry</div>
            <div className="text-[10px] text-omium-tertiary mt-0.5">Distributed Spans</div>
          </div>
          <div className="p-3.5 rounded-xl bg-void border border-white/5">
            <div className="font-bold text-white font-mono text-xs">React 18 + TS</div>
            <div className="text-[10px] text-omium-tertiary mt-0.5">Omium UI Dashboard</div>
          </div>
        </div>
      </div>

      {/* Bottom Launch Banner */}
      <div className="hud-panel rounded-2xl p-8 border border-omium-coral/30 bg-gradient-to-r from-void-card via-void-elevated to-void-card text-center space-y-4 shadow-omium-glow">
        <h2 className="text-2xl font-bold text-white font-sans">
          Ready to verify your agent pipeline in real time?
        </h2>
        <p className="text-xs text-omium-secondary max-w-xl mx-auto font-sans">
          Open the live mission control dashboard to monitor active agents, inspect checkpoints, and inject chaos failure modes.
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigate('overview')}
            className="px-6 py-3 rounded-xl bg-omium-coral hover:bg-omium-coral-hover text-white font-semibold text-sm font-sans transition-all shadow-lg inline-flex items-center gap-2"
          >
            <span>Launch PulseWatch Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
