import React from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Cpu,
  Radio,
  CheckCircle2,
  ExternalLink,
  Zap,
  Activity,
  Sparkles,
} from 'lucide-react';
import { ActivePage } from '../components/layout/Sidebar';
import { ConstellationCanvas } from '../components/common/ConstellationCanvas';
import { HeroPipelineVisual } from '../components/common/HeroPipelineVisual';
import logoImage from '../assets/logo.jpg';

interface WelcomePageProps {
  onNavigate: (page: ActivePage) => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onNavigate }) => {
  return (
    <div className="relative min-h-screen text-white overflow-hidden selection:bg-pulse-coral/30">
      {/* ─── Crazy High-Tech Multi-layered Background ──────────────────────── */}
      {/* Dynamic Cyber Grid */}
      <div className="fixed inset-0 grid-pattern opacity-60 pointer-events-none z-0" />
      <div className="fixed inset-0 cyber-dots opacity-30 pointer-events-none z-0" />

      {/* Floating Animated Gradient Orbs */}
      <div className="fixed -top-40 -left-40 w-[650px] h-[650px] bg-pulse-coral/20 rounded-full blur-[140px] pointer-events-none animate-blob-1 z-0" />
      <div className="fixed top-1/3 -right-40 w-[700px] h-[700px] bg-neon-sky/15 rounded-full blur-[160px] pointer-events-none animate-blob-2 z-0" />
      <div className="fixed -bottom-40 left-1/3 w-[600px] h-[600px] bg-neon-emerald/15 rounded-full blur-[140px] pointer-events-none animate-blob-1 z-0" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-neon-violet/10 rounded-full blur-[150px] pointer-events-none animate-spin-slow z-0" />

      {/* Interactive Constellation Particle Canvas */}
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-75">
        <ConstellationCanvas />
      </div>

      {/* Vignette Overlay for cinematic depth */}
      <div className="fixed inset-0 bg-radial-vignette pointer-events-none z-[2]" style={{
        background: 'radial-gradient(circle at 50% 30%, transparent 40%, #08090A 95%)'
      }} />

      {/* ─── Page Content (Z-10) ───────────────────────────────────────────── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-20">
        {/* Top Floating Telemetry Ticker */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-void-card/90 border border-white/10 text-xs font-mono text-pulse-secondary shadow-pulse-card backdrop-blur-xl animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-pulse-coral animate-ping" />
            <span className="text-white font-medium">PulseWatch 1.0</span>
            <span className="text-pulse-tertiary">·</span>
            <span className="text-neon-emerald font-semibold">Live Pipeline Online</span>
            <span className="text-pulse-tertiary">·</span>
            <span className="text-neon-sky">NATS JetStream (2,040 pts/s)</span>
          </div>
        </div>

        {/* ─── Animated Logo ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center animate-fade-in pb-4">
          <div className="relative w-32 h-32 md:w-40 md:h-40 group cursor-default">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-pulse-coral/20 rounded-full blur-2xl group-hover:bg-pulse-coral/30 group-hover:blur-3xl transition-all duration-700 animate-pulse" />
            <div className="absolute inset-0 bg-neon-sky/15 rounded-full blur-2xl translate-x-4 group-hover:bg-neon-sky/25 group-hover:blur-3xl transition-all duration-700 animate-pulse delay-150" />
            
            {/* The Logo Image */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-pulse-coral/50 shadow-2xl transition-all duration-700 bg-black animate-[float_6s_ease-in-out_infinite] hover:scale-105 z-10">
              <img src={logoImage} alt="PulseWatch Logo" className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Corner Decorative Accents */}
            <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-pulse-coral/50 rounded-tl z-20 group-hover:border-pulse-coral group-hover:-translate-x-1 group-hover:-translate-y-1 transition-all duration-500" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-neon-sky/50 rounded-br z-20 group-hover:border-neon-sky group-hover:translate-x-1 group-hover:translate-y-1 transition-all duration-500" />
          </div>
        </div>

        {/* ─── Hero Headline & Primary CTA ──────────────────────────────────── */}
        <div className="text-center space-y-6 max-w-4xl mx-auto animate-fade-in">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.08] font-sans">
              Your agent reported success.{' '}
              <span className="block mt-1 bg-gradient-to-r from-pulse-coral via-[#ff8f5a] to-neon-sky bg-clip-text text-transparent drop-shadow-sm">
                The row was never written.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-pulse-secondary leading-relaxed max-w-3xl mx-auto font-sans">
              Traditional tracing logs what your AI agents and microservices <span className="text-white font-medium">claim</span> they did. PulseWatch queries your database to verify the row actually landed — with autonomous counterfactual self-healing when writes fail silently.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('overview')}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-pulse-coral to-[#f07848] hover:from-[#f07848] hover:to-pulse-coral text-white font-bold text-sm font-sans transition-all shadow-pulse-glow flex items-center gap-2 group transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
              <span>Launch Mission Control</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigate('chaos')}
              className="px-5 py-3.5 rounded-xl bg-void-card/90 hover:bg-void-elevated border border-neon-rose/30 hover:border-neon-rose text-white font-medium text-sm transition-all flex items-center gap-2 backdrop-blur-md"
            >
              <Zap className="w-4 h-4 text-neon-rose" />
              <span>Chaos Lab Simulator</span>
            </button>

            <button
              onClick={() => onNavigate('diagnostics')}
              className="px-5 py-3.5 rounded-xl bg-void-card/90 hover:bg-void-elevated border border-neon-amber/30 hover:border-neon-amber text-white font-medium text-sm transition-all flex items-center gap-2 backdrop-blur-md"
            >
              <Cpu className="w-4 h-4 text-neon-amber" />
              <span>Agent Diagnostics</span>
            </button>
          </div>

          {/* Framework Integration Badges */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-pulse-tertiary">
            <span>Seamless SDK Drops for:</span>
            {['Go 1.22 Services', 'LangChain', 'LangGraph', 'CrewAI Agents', 'FastAPI', 'OpenTelemetry'].map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-pulse-secondary hover:text-white hover:border-white/20 transition-colors"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* ─── Real-Time Holographic Stat Counters ──────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <div className="p-5 rounded-2xl bg-void-card/80 border border-neon-emerald/25 shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-neon-emerald/50 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-pulse-tertiary mb-1 flex items-center justify-between">
              <span>Write Verification</span>
              <CheckCircle2 className="w-4 h-4 text-neon-emerald" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-neon-emerald">100.0%</div>
            <div className="text-[10px] font-mono text-pulse-secondary mt-1">Ground-truth verified writes</div>
          </div>

          <div className="p-5 rounded-2xl bg-void-card/80 border border-pulse-coral/25 shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-pulse-coral/50 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-pulse-tertiary mb-1 flex items-center justify-between">
              <span>Silent Failures</span>
              <ShieldCheck className="w-4 h-4 text-pulse-coral" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-white flex items-center gap-2">
              <span className="line-through text-pulse-tertiary text-xl">~2,500</span>
              <span className="text-neon-emerald">0 / day</span>
            </div>
            <div className="text-[10px] font-mono text-pulse-secondary mt-1">Autonomous catch & replay</div>
          </div>

          <div className="p-5 rounded-2xl bg-void-card/80 border border-neon-sky/25 shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-neon-sky/50 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-pulse-tertiary mb-1 flex items-center justify-between">
              <span>Throughput</span>
              <Radio className="w-4 h-4 text-neon-sky" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-neon-sky">2,040</div>
            <div className="text-[10px] font-mono text-pulse-secondary mt-1">Metric points / sec streamed</div>
          </div>

          <div className="p-5 rounded-2xl bg-void-card/80 border border-neon-amber/25 shadow-lg backdrop-blur-xl relative overflow-hidden group hover:border-neon-amber/50 transition-all">
            <div className="text-[11px] font-mono uppercase tracking-wider text-pulse-tertiary mb-1 flex items-center justify-between">
              <span>Agent Latency</span>
              <Activity className="w-4 h-4 text-neon-amber" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-neon-amber">&lt; 0.5ms</div>
            <div className="text-[10px] font-mono text-pulse-secondary mt-1">Non-blocking ring buffer</div>
          </div>
        </div>

        {/* ─── Interactive Hero Pipeline Visualizer ─────────────────────────── */}
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-xs font-mono uppercase tracking-widest text-pulse-coral font-semibold">
              // Real-Time Architecture Visualizer
            </span>
            <h2 className="text-2xl font-bold text-white font-sans mt-0.5">
              How PulseWatch Protects Your Data Integrity
            </h2>
          </div>
          <HeroPipelineVisual onExploreDashboard={() => onNavigate('overview')} />
        </div>

        {/* ─── 4-Step Verification Method ───────────────────────────────────── */}
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <span className="text-xs font-mono uppercase tracking-widest text-neon-sky font-semibold">
              // Ground-Truth Protocol
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans mt-1">
              From Silent Failure to Proof in Four Steps
            </h2>
            <p className="text-xs text-pulse-secondary mt-1">
              PulseWatch runs alongside your microservices without modifying application business logic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/80 hover:border-pulse-coral/40 backdrop-blur-xl transition-all group hover:-translate-y-1">
              <div className="text-3xl font-mono font-black text-pulse-coral mb-3 group-hover:scale-110 transition-transform">01</div>
              <h3 className="text-sm font-bold text-white font-mono mb-1">Connect</h3>
              <p className="text-xs text-pulse-secondary leading-relaxed">
                Drop the PulseWatch Go or Python SDK into your services with standard W3C traceparent propagation and non-blocking ring buffers.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/80 hover:border-neon-sky/40 backdrop-blur-xl transition-all group hover:-translate-y-1">
              <div className="text-3xl font-mono font-black text-neon-sky mb-3 group-hover:scale-110 transition-transform">02</div>
              <h3 className="text-sm font-bold text-white font-mono mb-1">Detect</h3>
              <p className="text-xs text-pulse-secondary leading-relaxed">
                Real-time ML Isolation Forests flag latency anomalies, schema shifts, or suspicious success responses that don't match traffic patterns.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/80 hover:border-neon-emerald/40 backdrop-blur-xl transition-all group hover:-translate-y-1">
              <div className="text-3xl font-mono font-black text-neon-emerald mb-3 group-hover:scale-110 transition-transform">03</div>
              <h3 className="text-sm font-bold text-white font-mono mb-1">Verify</h3>
              <p className="text-xs text-pulse-secondary leading-relaxed">
                We independently query TimescaleDB chunk tables to confirm row presence. If the row didn't land, counterfactual self-repair triggers.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/80 hover:border-neon-amber/40 backdrop-blur-xl transition-all group hover:-translate-y-1">
              <div className="text-3xl font-mono font-black text-neon-amber mb-3 group-hover:scale-110 transition-transform">04</div>
              <h3 className="text-sm font-bold text-white font-mono mb-1">Prove</h3>
              <p className="text-xs text-pulse-secondary leading-relaxed">
                Export cryptographically verified audit reports comparing current silent failure rates against baseline to prove 100% data reliability.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Interactive Feature Capabilities Matrix ─────────────────────── */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-pulse-coral font-semibold">
                // System Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans mt-1">
                Explore Full Mission Control
              </h2>
            </div>
            <button
              onClick={() => onNavigate('overview')}
              className="text-xs font-mono text-pulse-coral hover:underline flex items-center gap-1"
            >
              <span>Open all dashboard views</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Live Checkpoints */}
            <div
              onClick={() => onNavigate('checkpoints')}
              className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/85 hover:border-pulse-coral/50 cursor-pointer transition-all group backdrop-blur-xl hover:shadow-pulse-glow"
            >
              <div className="w-10 h-10 rounded-xl bg-pulse-coral/15 border border-pulse-coral/30 flex items-center justify-center text-pulse-coral mb-4 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
                <span>Live Checkpoints Feed</span>
                <span className="text-xs text-pulse-coral font-sans">Open →</span>
              </h3>
              <p className="text-xs text-pulse-secondary leading-relaxed mb-4">
                Real-time checkpoint transitions, schema verifications, and counterfactual recovery loops for in-flight tasks.
              </p>
              <div className="p-2.5 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-pulse-tertiary">
                <span className="text-pulse-coral font-bold">r_9af2</span> · supportAgent · <span className="text-neon-emerald">✓ Verified</span>
              </div>
            </div>

            {/* SLO Reliability */}
            <div
              onClick={() => onNavigate('slo')}
              className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/85 hover:border-neon-emerald/50 cursor-pointer transition-all group backdrop-blur-xl hover:shadow-pulse-glow"
            >
              <div className="w-10 h-10 rounded-xl bg-neon-emerald/15 border border-neon-emerald/30 flex items-center justify-center text-neon-emerald mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
                <span>SLO Compliance & Budget</span>
                <span className="text-xs text-neon-emerald font-sans">Open →</span>
              </h3>
              <p className="text-xs text-pulse-secondary leading-relaxed mb-4">
                Google SRE methodology tracking 99.9% availability, p99 latency ceilings, and real-time error budget burn rates.
              </p>
              <div className="p-2.5 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-pulse-tertiary flex items-center justify-between">
                <span className="text-white">Availability: 99.98%</span>
                <span className="text-neon-emerald font-bold">IN COMPLIANCE</span>
              </div>
            </div>

            {/* Service Topology */}
            <div
              onClick={() => onNavigate('topology')}
              className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/85 hover:border-neon-sky/50 cursor-pointer transition-all group backdrop-blur-xl hover:shadow-pulse-glow"
            >
              <div className="w-10 h-10 rounded-xl bg-neon-sky/15 border border-neon-sky/30 flex items-center justify-center text-neon-sky mb-4 group-hover:scale-110 transition-transform">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
                <span>Architecture Topology</span>
                <span className="text-xs text-neon-sky font-sans">Open →</span>
              </h3>
              <p className="text-xs text-pulse-secondary leading-relaxed mb-4">
                Interactive component dataflow graph with throughput (2,040 pts/s), JetStream queues, and TimescaleDB tables.
              </p>
              <div className="p-2.5 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-pulse-tertiary flex items-center justify-between">
                <span className="text-white">Pipeline Loss: 0.00%</span>
                <span className="text-neon-sky font-bold">STREAM ACTIVE</span>
              </div>
            </div>

            {/* Agent Diagnostics */}
            <div
              onClick={() => onNavigate('diagnostics')}
              className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/85 hover:border-neon-amber/50 cursor-pointer transition-all group backdrop-blur-xl hover:shadow-pulse-glow"
            >
              <div className="w-10 h-10 rounded-xl bg-neon-amber/15 border border-neon-amber/30 flex items-center justify-center text-neon-amber mb-4 group-hover:scale-110 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
                <span>Agent Diagnostics</span>
                <span className="text-xs text-neon-amber font-sans">Open →</span>
              </h3>
              <p className="text-xs text-pulse-secondary leading-relaxed mb-4">
                Deep process-level goroutine tracking, GC pause durations, and per-agent CPU/memory sparklines refreshed every 3s.
              </p>
              <div className="p-2.5 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-pulse-tertiary flex items-center justify-between">
                <span className="text-white">6 Agents Monitored</span>
                <span className="text-neon-amber font-bold">ALL HEALTHY</span>
              </div>
            </div>

            {/* Chaos Lab */}
            <div
              onClick={() => onNavigate('chaos')}
              className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/85 hover:border-neon-rose/50 cursor-pointer transition-all group backdrop-blur-xl hover:shadow-pulse-glow"
            >
              <div className="w-10 h-10 rounded-xl bg-neon-rose/15 border border-neon-rose/30 flex items-center justify-center text-neon-rose mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
                <span>Chaos Lab Simulator</span>
                <span className="text-xs text-neon-rose font-sans">Open →</span>
              </h3>
              <p className="text-xs text-pulse-secondary leading-relaxed mb-4">
                Inject network partitions, database pool exhaustion, and cascade tool failures. Watch real-time autonomous recovery.
              </p>
              <div className="p-2.5 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-pulse-tertiary flex items-center justify-between">
                <span className="text-white">6 Failure Scenarios</span>
                <span className="text-neon-rose font-bold">LAB READY</span>
              </div>
            </div>

            {/* Audit Proof */}
            <div
              onClick={() => onNavigate('audit')}
              className="p-6 rounded-2xl border border-white/[0.08] bg-void-card/85 hover:border-neon-emerald/50 cursor-pointer transition-all group backdrop-blur-xl hover:shadow-pulse-glow"
            >
              <div className="w-10 h-10 rounded-xl bg-neon-emerald/15 border border-neon-emerald/30 flex items-center justify-center text-neon-emerald mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono mb-1 flex items-center justify-between">
                <span>Failure Audit Proof</span>
                <span className="text-xs text-neon-emerald font-sans">Open →</span>
              </h3>
              <p className="text-xs text-pulse-secondary leading-relaxed mb-4">
                Executive-ready markdown verification audit certificates showing 0 unwritten rows and 100% verified operations.
              </p>
              <div className="p-2.5 rounded-lg bg-void border border-white/5 text-[11px] font-mono text-pulse-tertiary flex items-center justify-between">
                <span className="text-white">Audit Status</span>
                <span className="text-neon-emerald font-bold">CERTIFIED</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Production Infrastructure Showcase ───────────────────────────── */}
        <div className="p-8 rounded-3xl border border-white/[0.1] bg-void-card/80 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-pulse-coral font-semibold">
                // Distributed Backbone
              </span>
              <h3 className="text-xl font-bold text-white font-mono mt-0.5">
                Engineered for High-Throughput Production Environments
              </h3>
              <p className="text-xs text-pulse-secondary mt-1">
                Zero compromises on ingestion speed, fault tolerance, and data durability.
              </p>
            </div>
            <a
              href="http://localhost:16686"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-void hover:bg-void-elevated border border-white/10 text-xs font-mono text-neon-sky flex items-center gap-2 transition-colors self-start md:self-auto"
            >
              <span>Open Jaeger Distributed UI</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            <div className="p-4 rounded-xl bg-void/80 border border-white/5 hover:border-white/15 transition-colors">
              <div className="font-bold text-white font-mono text-xs">Go (1.22)</div>
              <div className="text-[10px] text-pulse-tertiary mt-0.5">Agent & Ingestion</div>
            </div>
            <div className="p-4 rounded-xl bg-void/80 border border-white/5 hover:border-neon-emerald/30 transition-colors">
              <div className="font-bold text-neon-emerald font-mono text-xs">TimescaleDB</div>
              <div className="text-[10px] text-pulse-tertiary mt-0.5">Hypertable Storage</div>
            </div>
            <div className="p-4 rounded-xl bg-void/80 border border-white/5 hover:border-neon-sky/30 transition-colors">
              <div className="font-bold text-neon-sky font-mono text-xs">NATS JetStream</div>
              <div className="text-[10px] text-pulse-tertiary mt-0.5">Durable Message Queue</div>
            </div>
            <div className="p-4 rounded-xl bg-void/80 border border-white/5 hover:border-neon-amber/30 transition-colors">
              <div className="font-bold text-neon-amber font-mono text-xs">Python ML</div>
              <div className="text-[10px] text-pulse-tertiary mt-0.5">Isolation Forest Detector</div>
            </div>
            <div className="p-4 rounded-xl bg-void/80 border border-white/5 hover:border-pulse-coral/30 transition-colors">
              <div className="font-bold text-pulse-coral font-mono text-xs">OpenTelemetry</div>
              <div className="text-[10px] text-pulse-tertiary mt-0.5">W3C Distributed Spans</div>
            </div>
            <div className="p-4 rounded-xl bg-void/80 border border-white/5 hover:border-white/15 transition-colors">
              <div className="font-bold text-white font-mono text-xs">React 18 + TS</div>
              <div className="text-[10px] text-pulse-tertiary mt-0.5">PulseWatch Mission Control</div>
            </div>
          </div>
        </div>

        {/* ─── Bottom Launch Banner ─────────────────────────────────────────── */}
        <div className="rounded-3xl p-8 sm:p-10 border border-pulse-coral/40 bg-gradient-to-r from-void-card via-[#15100d] to-void-card text-center space-y-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-pulse-coral/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-extrabold text-white font-sans tracking-tight">
              Ready to verify your mission-critical pipeline?
            </h2>
            <p className="text-xs sm:text-sm text-pulse-secondary font-sans leading-relaxed">
              Launch into the live PulseWatch dashboard to observe your active fleet, inspect real-time checkpoints, and verify database write integrity.
            </p>
            <div className="pt-3">
              <button
                onClick={() => onNavigate('overview')}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-pulse-coral to-[#f07848] hover:from-[#f07848] hover:to-pulse-coral text-white font-bold text-sm font-sans transition-all shadow-pulse-glow inline-flex items-center gap-2 group transform hover:scale-105"
              >
                <span>Launch PulseWatch Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
