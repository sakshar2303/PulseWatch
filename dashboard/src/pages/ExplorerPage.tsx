import React, { useState, useRef } from 'react';
import { MetricChart } from '../components/charts/MetricChart';
import { useMetrics, TIME_RANGE_CONFIGS } from '../hooks/useMetrics';
import { useForecasts } from '../hooks/useForecasts';
import { TimeRangePreset, HostInfo, ServiceInfo } from '../types';
import { Sliders, Database, ChevronDown, BrainCircuit, Sparkles, Send, Loader2, AlertCircle } from 'lucide-react';
import { nlQuery, NLQueryResult } from '../services/api';

const TIME_RANGE_MAP: Record<string, TimeRangePreset> = {
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '6h': '6h',
  '24h': '24h',
  '7d': '7d',
};

const EXAMPLE_PROMPTS = [
  'Show me peak CPU over the last hour',
  'Average memory usage for the last 24 hours',
  'Max goroutines in the last 15 minutes',
  'Minimum heap allocation today',
];

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
  const [customStep] = useState<string>('');
  const [localTimeRange, setLocalTimeRange] = useState<TimeRangePreset>(timeRange);

  // NL Query state
  const [nlPrompt, setNlPrompt] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState<NLQueryResult | null>(null);
  const [nlError, setNlError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stepToUse = customStep || TIME_RANGE_CONFIGS[localTimeRange]?.defaultStep || '1m';

  const { data, loading, error, refetch } = useMetrics({
    name: metricName,
    timeRange: localTimeRange,
    agg,
    step: stepToUse,
    host: localHost,
    service: localService,
  });

  const { forecasts, loading: forecastLoading } = useForecasts(metricName, localHost, localService);

  const unit = metricName.includes('percent')
    ? '%'
    : metricName.includes('bytes')
    ? 'bytes'
    : '';

  const seriesStats = (data?.series || []).map((s) => {
    const values = s.datapoints.map((d) => d.value);
    const count = values.length;
    const min = count > 0 ? Math.min(...values) : 0;
    const max = count > 0 ? Math.max(...values) : 0;
    const avg = count > 0 ? values.reduce((a, b) => a + b, 0) / count : 0;
    const latest = count > 0 ? values[values.length - 1] : 0;
    return { host: s.host, service: s.service, count, min, max, avg, latest };
  });

  const handleNLQuery = async (promptOverride?: string) => {
    const prompt = promptOverride ?? nlPrompt;
    if (!prompt.trim()) return;
    setNlLoading(true);
    setNlError(null);
    setNlResult(null);
    try {
      const result = await nlQuery(prompt, availableMetrics);
      setNlResult(result);
      // Auto-apply to controls
      if (result.metric_name && availableMetrics.includes(result.metric_name)) {
        setMetricName(result.metric_name);
      }
      if (result.aggregation) setAgg(result.aggregation as 'avg' | 'max' | 'min');
      if (result.time_range && TIME_RANGE_MAP[result.time_range]) {
        setLocalTimeRange(TIME_RANGE_MAP[result.time_range]);
      }
      setLocalHost(result.host || '');
      setLocalService(result.service || '');
    } catch (err: any) {
      setNlError(err.message || 'AI query failed');
    } finally {
      setNlLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setNlPrompt(example);
    handleNLQuery(example);
  };

  return (
    <div className="space-y-6 pb-12">

      {/* ─── AI Natural Language Search Bar ─── */}
      <div className="hud-panel rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/20 to-transparent p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <BrainCircuit className="w-4 h-4 text-violet-400" style={{ filter: 'drop-shadow(0 0 6px rgb(139 92 246 / 0.8))' }} />
          <span>AI Metric Query</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase tracking-wider">Claude 3.5</span>
        </div>

        {/* Input row */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Sparkles className="w-3.5 h-3.5 text-violet-400/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={nlPrompt}
              onChange={(e) => setNlPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNLQuery()}
              placeholder='e.g. "show me peak CPU over the last hour"'
              className="w-full bg-carbon-850/80 border border-violet-500/30 text-slate-200 text-sm rounded-lg pl-9 pr-4 py-2.5 outline-none focus:border-violet-400/60 focus:ring-1 focus:ring-violet-500/20 font-mono placeholder:text-slate-600 transition-all"
            />
          </div>
          <button
            onClick={() => handleNLQuery()}
            disabled={nlLoading || !nlPrompt.trim()}
            className="px-4 py-2.5 rounded-lg bg-violet-600/80 hover:bg-violet-500/80 disabled:opacity-40 disabled:cursor-not-allowed text-white border border-violet-500/40 text-sm font-medium transition-all flex items-center gap-2 shrink-0"
          >
            {nlLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {nlLoading ? 'Thinking...' : 'Ask AI'}
          </button>
        </div>

        {/* Example prompts */}
        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] font-mono text-slate-500 self-center">Try:</span>
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              onClick={() => handleExampleClick(ex)}
              className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800/60 hover:bg-violet-900/40 hover:text-violet-300 text-slate-400 border border-slate-700/50 hover:border-violet-500/30 transition-all"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* AI result callout */}
        {nlError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-500/20 text-xs font-mono text-rose-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{nlError}</span>
          </div>
        )}
        {nlResult && !nlError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-950/30 border border-violet-500/20">
            <BrainCircuit className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-violet-400 uppercase tracking-wider font-semibold">AI Interpretation</p>
              <p className="text-xs text-slate-300">{nlResult.explanation}</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {[
                  { label: 'Metric', val: nlResult.metric_name },
                  { label: 'Agg', val: nlResult.aggregation },
                  { label: 'Range', val: nlResult.time_range },
                  ...(nlResult.host ? [{ label: 'Host', val: nlResult.host }] : []),
                  ...(nlResult.service ? [{ label: 'Service', val: nlResult.service }] : []),
                ].map(({ label, val }) => (
                  <span key={label} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800/60 border border-slate-700/50">
                    <span className="text-slate-500">{label}:</span>{' '}
                    <span className="text-violet-300 font-medium">{val}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Manual Controls Bar ─── */}
      <div className="hud-panel rounded-xl p-5 border border-slate-850 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-850 text-sm font-semibold text-white">
          <Sliders className="w-4 h-4 text-neon-cyan" />
          <span>Metric Query &amp; Downsampling Builder</span>
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
                  <option key={m} value={m} className="bg-[#0D0F12] text-white">{m}</option>
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

          {/* Time Range */}
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Time Range</label>
            <div className="relative">
              <select
                value={localTimeRange}
                onChange={(e) => setLocalTimeRange(e.target.value as TimeRangePreset)}
                className="w-full appearance-none bg-carbon-850 border border-slate-800 text-slate-200 text-xs rounded-lg pl-3 pr-8 py-2 outline-none focus:border-neon-cyan/50 font-mono cursor-pointer"
              >
                {Object.keys(TIME_RANGE_MAP).map((r) => (
                  <option key={r} value={r} className="bg-[#0D0F12] text-white">{r}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
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
        forecasts={forecasts}
        loading={loading || forecastLoading}
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
