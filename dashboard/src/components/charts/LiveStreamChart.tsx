import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { MetricPoint } from '../../types';
import { Radio, Zap } from 'lucide-react';
import { ConnectionStatus } from '../../services/websocket';

interface LiveStreamChartProps {
  points: MetricPoint[];
  wsStatus: ConnectionStatus;
  lastTick: Date | null;
  availableMetrics?: string[];
  height?: number;
}

export const LiveStreamChart: React.FC<LiveStreamChartProps> = ({
  points,
  wsStatus,
  lastTick,
  availableMetrics = ['cpu_usage_percent', 'memory_usage_percent', 'disk_usage_percent'],
  height = 280,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<string>('cpu_usage_percent');

  // Filter points for selected metric and format for Recharts
  const chartData = useMemo(() => {
    return points
      .filter((p) => p.metric_name === selectedMetric)
      .map((p) => ({
        time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        value: Number(p.value.toFixed(2)),
        host: p.host,
        service: p.service,
        rawTimestamp: new Date(p.timestamp).getTime(),
      }));
  }, [points, selectedMetric]);

  const latestVal = chartData.length > 0 ? chartData[chartData.length - 1].value : null;

  return (
    <div className="hud-panel rounded-xl p-5 border border-slate-850 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-neon-cyan animate-pulse" />
            <h3 className="text-sm font-semibold text-white tracking-wide">Live WebSocket Stream</h3>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-carbon-850 border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className={`w-1.5 h-1.5 rounded-full ${
              wsStatus === 'connected' ? 'bg-neon-cyan animate-ping' : 'bg-rose-500'
            }`} />
            <span>{wsStatus}</span>
          </div>

          {lastTick && (
            <span className="text-[11px] font-mono text-slate-500">
              Tick: {lastTick.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Metric Selector Tabs */}
        <div className="flex items-center bg-carbon-850 rounded-lg border border-slate-800 p-0.5">
          {availableMetrics.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMetric(m)}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                selectedMetric === m
                  ? 'bg-neon-cyan/20 text-neon-cyan font-semibold border border-neon-cyan/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.replace(/_percent|_bytes/g, '').replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Latest Value Banner */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-carbon-850/60 border border-slate-800/60 mb-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-400">
          <Zap className="w-3.5 h-3.5 text-neon-cyan" />
          <span>Active Metric: <strong className="text-slate-200">{selectedMetric}</strong></span>
        </div>
        <div>
          <span className="text-slate-400 mr-2">Latest Value:</span>
          <span className="text-neon-cyan font-bold text-sm">
            {latestVal !== null ? `${latestVal}${selectedMetric.includes('percent') ? '%' : ''}` : 'Waiting for telemetry...'}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }} className="relative w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-xs font-mono text-slate-500">
            <Radio className="w-8 h-8 text-slate-700 animate-pulse mb-2" />
            <span>Subscribed to NATS JetStream live telemetry...</span>
            <span className="text-[10px] text-slate-600 mt-1">Collecting live ticks via WebSocket</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                minTickGap={30}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                domain={selectedMetric.includes('percent') ? [0, 100] : ['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="hud-panel p-2.5 rounded-lg border border-slate-750 text-xs font-mono shadow-xl">
                      <div className="text-slate-400 mb-1">{label}</div>
                      <div className="text-neon-cyan font-bold">
                        {payload[0].value} {selectedMetric.includes('percent') ? '%' : ''}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Host: {payload[0].payload.host}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#06b6d4', stroke: '#06090e', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
