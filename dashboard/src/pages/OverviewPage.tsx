import React from 'react';
import { StatCard } from '../components/common/StatCard';
import { MetricChart } from '../components/charts/MetricChart';
import { LiveStreamChart } from '../components/charts/LiveStreamChart';
import { AnomalyFeed } from '../components/alerts/AnomalyFeed';
import { useMetrics } from '../hooks/useMetrics';
import { useLiveStream } from '../hooks/useLiveStream';
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

  // Calculate current average values for KPI cards
  const latestCpu = cpuMetric.data?.series?.[0]?.datapoints?.slice(-1)[0]?.value ?? null;
  const latestMem = memMetric.data?.series?.[0]?.datapoints?.slice(-1)[0]?.value ?? null;
  const latestDisk = diskMetric.data?.series?.[0]?.datapoints?.slice(-1)[0]?.value ?? null;

  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved_at);

  return (
    <div className="space-y-6 pb-12">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Monitored Hosts"
          value={hosts.length}
          subtitle={`${hosts.filter((h) => h.status === 'healthy').length} healthy`}
          icon={Server}
          color="cyan"
        />

        <StatCard
          title="Active Services"
          value={services.length}
          subtitle="Services monitored"
          icon={Layers}
          color="violet"
        />

        <StatCard
          title="Avg CPU Load"
          value={latestCpu !== null ? latestCpu.toFixed(1) : '--'}
          unit="%"
          subtitle="Fleet cluster avg"
          icon={Cpu}
          color={latestCpu && latestCpu > 80 ? 'rose' : 'emerald'}
        />

        <StatCard
          title="Memory Pressure"
          value={latestMem !== null ? latestMem.toFixed(1) : '--'}
          unit="%"
          subtitle="Fleet memory used"
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
          title="Active Alerts"
          value={unresolvedAnomalies.length}
          subtitle={unresolvedAnomalies.length > 0 ? 'Requires attention' : 'Systems nominal'}
          icon={AlertTriangle}
          color={unresolvedAnomalies.length > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Main Telemetry Charts Grid */}
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

      {/* Real-time WebSocket Live Stream & Anomalies Feed Row */}
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
    </div>
  );
};
