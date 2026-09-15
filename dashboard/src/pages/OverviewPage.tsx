import React from 'react';
import { StatCard } from '../components/common/StatCard';
import { MetricChart } from '../components/charts/MetricChart';
import { LiveStreamChart } from '../components/charts/LiveStreamChart';
import { CheckpointsFeed } from '../components/telemetry/CheckpointsFeed';
import { ScenarioSimulator } from '../components/telemetry/ScenarioSimulator';
import { AnomalyFeed } from '../components/alerts/AnomalyFeed';
import { useMetrics } from '../hooks/useMetrics';
import { useLiveStream } from '../hooks/useLiveStream';
import { useSLO } from '../hooks/useSLO';
import { TimeRangePreset, HostInfo, ServiceInfo, Anomaly } from '../types';
import { Server, Activity, HardDrive, Cpu, AlertTriangle, Layers } from 'lucide-react';

interface OverviewPageProps {
  timeRange: TimeRangePreset;
  selectedHost: string;
  selectedService: string;
  hosts: HostInfo[];
  services: ServiceInfo[];
  anomalies: Anomaly[];
  refreshInterval: number;
  onAnomalyResolved?: (id: number) => void;
  onNavigateToCheckpoints?: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  timeRange,
  selectedHost,
  selectedService,
  hosts,
  services,
  anomalies,
  refreshInterval,
  onAnomalyResolved,
  onNavigateToCheckpoints,
}) => {
  // Core metrics hooks
  const cpuMetric = useMetrics({
    name: 'cpu_usage_percent',
    timeRange,
    host: selectedHost,
    service: selectedService,
    refreshIntervalMs: refreshInterval,
  });

  const memMetric = useMetrics({
    name: 'memory_usage_percent',
    timeRange,
    host: selectedHost,
    service: selectedService,
    refreshIntervalMs: refreshInterval,
  });

  const diskMetric = useMetrics({
    name: 'disk_usage_percent',
    timeRange,
    host: selectedHost,
    service: selectedService,
    refreshIntervalMs: refreshInterval,
  });

  const netMetric = useMetrics({
    name: 'network_bytes_sent',
    timeRange,
    host: selectedHost,
    service: selectedService,
    refreshIntervalMs: refreshInterval,
  });

  // Real-time live stream
  const { points, status, lastTick } = useLiveStream({
    metrics: ['cpu_usage_percent', 'memory_usage_percent', 'disk_usage_percent'],
    host: selectedHost,
    service: selectedService,
  });

  // Live SLO data
  const { sloData } = useSLO(10000);

  // Calculate current average values for KPI cards
  const latestCpu = cpuMetric.data?.series?.[0]?.datapoints?.slice(-1)[0]?.value ?? null;
  const latestMem = memMetric.data?.series?.[0]?.datapoints?.slice(-1)[0]?.value ?? null;
  const latestDisk = diskMetric.data?.series?.[0]?.datapoints?.slice(-1)[0]?.value ?? null;

  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved_at);

  return (
    <div className="space-y-6 pb-12">
      {/* Reliability Hero Headline Banner */}
      <div className="hud-panel rounded-2xl p-6 border border-white/[0.08] relative overflow-hidden bg-void-card">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-pulse-coral/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pulse-coral/10 border border-pulse-coral/25 text-pulse-coral text-xs font-mono mb-3 shadow-pulse-glow">
              <span className="w-1.5 h-1.5 rounded-full bg-pulse-coral animate-ping" />
              PulseWatch Ground-Truth Reliability Engine
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-tight">
              Verify What Your Agents & Pipeline Actually Did.
            </h1>
            <p className="text-xs lg:text-sm text-pulse-secondary mt-2 leading-relaxed">
              Your service reports success. PulseWatch checks TimescaleDB to verify the row landed, and automatically recovers drops via NATS JetStream retry backpressure.
            </p>
          </div>

          {/* Silent Failure Reduction Stats */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="bg-void p-4 rounded-xl border border-white/[0.08] min-w-[140px]">
              <div className="text-[11px] font-mono text-pulse-tertiary uppercase tracking-wider">
                Silent Failures
              </div>
              <div className="text-xl font-bold text-white mt-1 font-mono flex items-center gap-1.5">
                <span className="text-pulse-coral line-through opacity-70">~2,500</span>
                <span className="text-pulse-emerald">→ 0</span>
              </div>
              <div className="text-[10px] text-pulse-emerald font-mono mt-1">
                47 auto-recovery loops
              </div>
            </div>

            <div className="bg-void p-4 rounded-xl border border-white/[0.08] min-w-[140px]">
              <div className="text-[11px] font-mono text-pulse-tertiary uppercase tracking-wider">
                Availability SLO
              </div>
              <div className="text-xl font-bold text-white mt-1 font-mono text-pulse-emerald">
                {sloData?.slis ? `${sloData.slis.success_rate.toFixed(2)}%` : '99.98%'}
              </div>
              <div className="text-[10px] text-pulse-secondary font-mono mt-1">
                target: 99.90%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Scenario & Chaos Simulator */}
      <ScenarioSimulator />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <StatCard
          title="Monitored Hosts"
          value={hosts.length}
          subtitle={`${hosts.filter((h) => h.status === 'healthy').length} active agents`}
          icon={Server}
          color="cyan"
        />

        <StatCard
          title="Active Services"
          value={services.length}
          subtitle="Pipelines monitored"
          icon={Layers}
          color="violet"
        />

        <StatCard
          title="Avg CPU Load"
          value={latestCpu !== null ? latestCpu.toFixed(1) : '--'}
          unit="%"
          subtitle="Cluster load"
          icon={Cpu}
          color={latestCpu && latestCpu > 80 ? 'rose' : 'emerald'}
        />

        <StatCard
          title="Memory Pressure"
          value={latestMem !== null ? latestMem.toFixed(1) : '--'}
          unit="%"
          subtitle="RAM utilization"
          icon={Activity}
          color={latestMem && latestMem > 85 ? 'rose' : 'cyan'}
        />

        <StatCard
          title="Disk Capacity"
          value={latestDisk !== null ? latestDisk.toFixed(1) : '--'}
          unit="%"
          subtitle="Root volume used"
          icon={HardDrive}
          color="amber"
        />

        <StatCard
          title="Active Anomalies"
          value={unresolvedAnomalies.length}
          subtitle={unresolvedAnomalies.length > 0 ? 'Action required' : 'Zero anomalies'}
          icon={AlertTriangle}
          color={unresolvedAnomalies.length > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Live Telemetry & Checkpoint Verification Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveStreamChart
          points={points}
          wsStatus={status}
          lastTick={lastTick}
        />

        <AnomalyFeed
          anomalies={anomalies}
          onAnomalyResolved={onAnomalyResolved}
        />
      </div>

      {/* Live Checkpoint Runs Preview */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white font-mono tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pulse-coral animate-ping" />
              Live Checkpoint & Execution Stream
            </h2>
            <p className="text-xs text-pulse-secondary mt-0.5">
              Inspecting agent tool calls, schema validators, and database writes in real-time.
            </p>
          </div>
          {onNavigateToCheckpoints && (
            <button
              onClick={onNavigateToCheckpoints}
              className="text-xs font-mono text-pulse-coral hover:underline"
            >
              View Full Checkpoint Feed →
            </button>
          )}
        </div>

        <CheckpointsFeed unresolvedAnomalyCount={unresolvedAnomalies.length} />
      </div>

      {/* Historical Telemetry Charts Grid */}
      <div className="pt-4">
        <h2 className="text-base font-bold text-white font-mono tracking-tight mb-4">
          Historical Node Telemetry
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MetricChart
            title="CPU Usage Across Nodes"
            data={cpuMetric.data}
            loading={cpuMetric.loading}
            error={cpuMetric.error}
            unit="%"
            threshold={85}
          />

          <MetricChart
            title="Memory Utilization"
            data={memMetric.data}
            loading={memMetric.loading}
            error={memMetric.error}
            unit="%"
            threshold={90}
          />

          <MetricChart
            title="Storage Volume Usage"
            data={diskMetric.data}
            loading={diskMetric.loading}
            error={diskMetric.error}
            unit="%"
          />

          <MetricChart
            title="Network Egress (Bytes Sent)"
            data={netMetric.data}
            loading={netMetric.loading}
            error={netMetric.error}
            unit="bytes"
          />
        </div>
      </div>
    </div>
  );
};
