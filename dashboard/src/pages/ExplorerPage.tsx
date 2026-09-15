import React, { useState } from 'react';
import { MetricChart } from '../components/charts/MetricChart';
import { useMetrics, TIME_RANGE_CONFIGS } from '../hooks/useMetrics';
import { TimeRangePreset, HostInfo, ServiceInfo } from '../types';
import { Sliders, Database, ChevronDown } from 'lucide-react';

interface ExplorerPageProps {
  availableMetrics: string[];
  hosts: HostInfo[];
  services: ServiceInfo[];
  timeRange: TimeRangePreset;
  selectedHost: string;
  selectedService: string;
}

export const ExplorerPage: React.FC<ExplorerPageProps> = ({
  availableMetrics,
  hosts,
  services,
  timeRange,
  selectedHost: initialHost,
  selectedService: initialService,
}) => {
  const [localHost, setLocalHost] = useState<string>(initialHost);
  const [localService, setLocalService] = useState<string>(initialService);
  const [metricName, setMetricName] = useState<string>(
    availableMetrics[0] || 'cpu_usage_percent'
  );
  const [agg, setAgg] = useState<'avg' | 'max' | 'min'>('avg');
  const [customStep, setCustomStep] = useState<string>('');

  const stepToUse = customStep || TIME_RANGE_CONFIGS[timeRange]?.defaultStep || '1m';

  const { data, loading, error, refetch } = useMetrics({
    name: metricName,
    timeRange,
    agg,
    step: stepToUse,
    host: localHost,
    service: localService,
  });

  // Infer unit from metric name
  const unit = metricName.includes('percent')
    ? '%'
    : metricName.includes('bytes')
    ? 'bytes'
    : '';

  // Calculate series summary statistics
  const seriesStats = (data?.series || []).map((s) => {
    const values = s.datapoints.map((d) => d.value);
    const count = values.length;
    const min = count > 0 ? Math.min(...values) : 0;
    const max = count > 0 ? Math.max(...values) : 0;
    const avg = count > 0 ? values.reduce((a, b) => a + b, 0) / count : 0;
    const latest = count > 0 ? values[values.length - 1] : 0;

    return {
      host: s.host,
      service: s.service,
      count,
      min,
      max,
      avg,
      latest,
    };
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Explorer Controls Bar */}
      <div className="hud-panel rounded-xl p-5 border border-slate-850 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-850 text-sm font-semibold text-white">
          <Sliders className="w-4 h-4 text-neon-cyan" />
          <span>Metric Query & Downsampling Builder</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Metric Selector */}
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Metric</label>
            <div className="relative">
              <select
                value={metricName}
                onChange={(e) => setMetricName(e.target.value)}
                className="w-full appearance-none bg-carbon-850 border border-slate-800 text-slate-200 text-xs rounded-lg pl-3 pr-8 py-2 outline-none focus:border-neon-cyan/50 font-mono cursor-pointer"
              >
                {availableMetrics.map((m) => (
                  <option key={m} value={m} className="bg-[#0D0F12] text-white">
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Aggregator */}
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Aggregation</label>
            <div className="relative">
              <select
                value={agg}
                onChange={(e) => setAgg(e.target.value as any)}
                className="w-full appearance-none bg-carbon-850 border border-slate-800 text-slate-200 text-xs rounded-lg pl-3 pr-8 py-2 outline-none focus:border-neon-cyan/50 font-mono cursor-pointer"
              >
                <option value="avg" className="bg-[#0D0F12] text-white">avg (Mean)</option>
                <option value="max" className="bg-[#0D0F12] text-white">max (Peak)</option>
                <option value="min" className="bg-[#0D0F12] text-white">min (Trough)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Downsampling Step */}
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Step Interval</label>
            <input
              type="text"
              placeholder={`Auto (${TIME_RANGE_CONFIGS[timeRange]?.defaultStep})`}
              value={customStep}
              onChange={(e) => setCustomStep(e.target.value)}
              className="w-full bg-carbon-850 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:border-neon-cyan/50 font-mono"
            />
          </div>

          {/* Host Filter */}
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Host Filter</label>
            <div className="relative">
              <select
                value={localHost}
                onChange={(e) => setLocalHost(e.target.value)}
                className="w-full appearance-none bg-carbon-850 border border-slate-800 text-slate-200 text-xs rounded-lg pl-3 pr-8 py-2 outline-none focus:border-neon-cyan/50 font-mono cursor-pointer"
              >
                <option value="" className="bg-[#0D0F12] text-white">All Hosts</option>
                {hosts.map((h) => (
                  <option key={h.name} value={h.name} className="bg-[#0D0F12] text-white">{h.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Service Filter */}
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Service Filter</label>
            <div className="relative">
              <select
                value={localService}
                onChange={(e) => setLocalService(e.target.value)}
                className="w-full appearance-none bg-carbon-850 border border-slate-800 text-slate-200 text-xs rounded-lg pl-3 pr-8 py-2 outline-none focus:border-neon-cyan/50 font-mono cursor-pointer"
              >
                <option value="" className="bg-[#0D0F12] text-white">All Services</option>
                {services.map((s) => (
                  <option key={s.name} value={s.name} className="bg-[#0D0F12] text-white">{s.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Refresh Action */}
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="w-full px-4 py-2 rounded-lg bg-neon-cyan/15 hover:bg-neon-cyan/25 text-neon-cyan border border-neon-cyan/30 text-xs font-mono font-medium transition-all"
            >
              Execute Query
            </button>
          </div>
        </div>
      </div>

      {/* Primary Chart */}
      <MetricChart
        title={`${metricName} (${agg.toUpperCase()} / step: ${stepToUse})`}
        data={data}
        loading={loading}
        error={error}
        unit={unit}
        agg={agg}
        onAggChange={(a) => setAgg(a)}
        height={340}
      />

      {/* Series Summary Table */}
      <div className="hud-panel rounded-xl p-5 border border-slate-850 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Database className="w-4 h-4 text-neon-emerald" />
          <span>Aggregated Series Breakdown</span>
        </div>

        {seriesStats.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-6 text-center">
            No series datapoints returned for the current query filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Host</th>
                  <th className="py-2.5 px-3">Service</th>
                  <th className="py-2.5 px-3">Datapoints</th>
                  <th className="py-2.5 px-3">Min</th>
                  <th className="py-2.5 px-3">Max</th>
                  <th className="py-2.5 px-3">Average</th>
                  <th className="py-2.5 px-3">Latest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {seriesStats.map((stat, idx) => (
                  <tr key={idx} className="hover:bg-carbon-850/50">
                    <td className="py-2.5 px-3 text-slate-200 font-medium">{stat.host}</td>
                    <td className="py-2.5 px-3 text-slate-400">{stat.service}</td>
                    <td className="py-2.5 px-3 text-slate-300">{stat.count}</td>
                    <td className="py-2.5 px-3 text-cyan-400">{stat.min.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-rose-400">{stat.max.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{stat.avg.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-white font-bold">{stat.latest.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
