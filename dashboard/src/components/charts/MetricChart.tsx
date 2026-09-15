import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { QueryResult } from '../../types';
import { Loader2 } from 'lucide-react';

const SERIES_COLORS = [
  '#e86a38', // omium-coral
  '#6ea8fe', // omium-sky
  '#34d399', // omium-emerald
  '#f2c94c', // omium-amber
  '#f87171', // omium-rose
  '#a78bfa', // omium-violet
];

interface MetricChartProps {
  title: string;
  data: QueryResult | null;
  loading?: boolean;
  error?: string | null;
  unit?: string;
  agg?: 'avg' | 'max' | 'min' | 'sum' | 'count';
  onAggChange?: (agg: 'avg' | 'max' | 'min') => void;
  threshold?: number;
  height?: number;
  formatter?: (val: number) => string;
}

export const MetricChart: React.FC<MetricChartProps> = ({
  title,
  data,
  loading = false,
  error = null,
  unit = '',
  agg = 'avg',
  onAggChange,
  threshold,
  height = 260,
  formatter,
}) => {
  // Transform SeriesResult[] into flat array of { time: string, [host]: number }
  const { chartData, seriesKeys } = useMemo(() => {
    if (!data || !data.series || data.series.length === 0) {
      return { chartData: [], seriesKeys: [] };
    }

    const timeMap = new Map<string, Record<string, any>>();
    const keys: string[] = [];

    data.series.forEach((s) => {
      const key = s.host || s.service || 'value';
      if (!keys.includes(key)) keys.push(key);

      s.datapoints.forEach((dp) => {
        // Quantize time to ISO string
        const tStr = new Date(dp.time).toISOString();
        if (!timeMap.has(tStr)) {
          timeMap.set(tStr, { time: tStr, timestamp: new Date(dp.time).getTime() });
        }
        timeMap.get(tStr)![key] = Number(dp.value.toFixed(2));
      });
    });

    const sortedData = Array.from(timeMap.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );

    return { chartData: sortedData, seriesKeys: keys };
  }, [data]);

  const defaultFormatter = (val: number) => {
    if (formatter) return formatter(val);
    if (unit === '%') return `${val.toFixed(1)}%`;
    if (unit === 'bytes') {
      if (val >= 1073741824) return `${(val / 1073741824).toFixed(1)} GB`;
      if (val >= 1048576) return `${(val / 1048576).toFixed(1)} MB`;
      if (val >= 1024) return `${(val / 1024).toFixed(1)} KB`;
      return `${val} B`;
    }
    return `${val.toFixed(2)} ${unit}`.trim();
  };

  return (
    <div className="hud-panel rounded-xl p-5 border border-white/[0.07] bg-void-card flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-white tracking-wide font-mono uppercase">{title}</h3>
          {unit && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-omium-secondary border border-white/10">
              {unit}
            </span>
          )}
        </div>

        {/* Aggregation Selector */}
        {onAggChange && (
          <div className="flex items-center bg-void rounded-md border border-white/[0.08] p-0.5 text-[10px] font-mono">
            {(['avg', 'max', 'min'] as const).map((a) => (
              <button
                key={a}
                onClick={() => onAggChange(a)}
                className={`px-2 py-0.5 rounded uppercase ${
                  agg === a
                    ? 'bg-omium-coral/20 text-omium-coral font-bold border border-omium-coral/30'
                    : 'text-omium-secondary hover:text-white'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div style={{ height }} className="relative w-full">
        {loading && (
          <div className="absolute inset-0 bg-void/60 backdrop-blur-xs flex items-center justify-center z-10">
            <Loader2 className="w-5 h-5 animate-spin text-omium-coral" />
          </div>
        )}

        {error ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-omium-rose">
            {error}
          </div>
        ) : chartData.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-xs font-mono text-omium-tertiary">
            <span>No data in selected range</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                {seriesKeys.map((key, idx) => {
                  const color = SERIES_COLORS[idx % SERIES_COLORS.length];
                  return (
                    <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                    </linearGradient>
                  );
                })}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />

              <XAxis
                dataKey="time"
                stroke="#5b616e"
                tick={{ fontSize: 10, fill: '#8a8f98', fontFamily: 'monospace' }}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                }}
                minTickGap={40}
              />

              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                domain={unit === '%' ? [0, 100] : ['auto', 'auto']}
                tickFormatter={(val) => (unit === '%' ? `${val}%` : String(val))}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const date = label ? new Date(label).toLocaleTimeString() : '';
                  return (
                    <div className="hud-panel p-2.5 rounded-lg border border-slate-750 text-xs font-mono shadow-xl">
                      <div className="text-slate-400 mb-1.5 pb-1 border-b border-slate-800">
                        {date}
                      </div>
                      {payload.map((entry: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-slate-300">{entry.name}:</span>
                          </div>
                          <span className="font-semibold text-white">
                            {defaultFormatter(Number(entry.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />

              {threshold !== undefined && (
                <ReferenceLine
                  y={threshold}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{
                    value: `Threshold ${threshold}${unit}`,
                    fill: '#f43f5e',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                />
              )}

              {seriesKeys.map((key, idx) => {
                const color = SERIES_COLORS[idx % SERIES_COLORS.length];
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#gradient-${key})`}
                    isAnimationActive={false}
                  />
                );
              })}

              {seriesKeys.length > 1 && (
                <Legend
                  wrapperStyle={{ paddingTop: '8px' }}
                  formatter={(value) => (
                    <span className="text-[11px] font-mono text-slate-300">{value}</span>
                  )}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
