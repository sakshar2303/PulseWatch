import React from 'react';
import { Activity, RefreshCw, Database, Cpu, Wifi } from 'lucide-react';
import { HealthResponse, TimeRangePreset } from '../../types';
import { ConnectionStatus } from '../../services/websocket';
import { TIME_RANGE_CONFIGS } from '../../hooks/useMetrics';

interface HeaderProps {
  health: HealthResponse | null;
  wsStatus: ConnectionStatus;
  timeRange: TimeRangePreset;
  onTimeRangeChange: (range: TimeRangePreset) => void;
  refreshInterval: number;
  onRefreshIntervalChange: (interval: number) => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  wsStatus,
  timeRange,
  onTimeRangeChange,
  refreshInterval,
  onRefreshIntervalChange,
  onManualRefresh,
  isRefreshing,
}) => {
  const tsdbHealthy = health?.dependencies?.timescaledb?.status === 'healthy';
  const natsHealthy = health?.dependencies?.nats?.status === 'healthy';

  return (
    <header className="h-16 border-b border-slate-850 bg-carbon-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & HUD status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan glow-cyan">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">PulseWatch</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
                v0.1.0
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">Mission Control</span>
          </div>
        </div>

        {/* System HUD Badges */}
        <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs font-mono">
          {/* TimescaleDB HUD */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            tsdbHealthy ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400' : 'bg-rose-950/40 border-rose-800/40 text-rose-400'
          }`}>
            <Database className="w-3.5 h-3.5" />
            <span>TimescaleDB</span>
            <span className={`w-1.5 h-1.5 rounded-full ${tsdbHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          </div>

          {/* NATS JetStream HUD */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            natsHealthy ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400' : 'bg-amber-950/40 border-amber-800/40 text-amber-400'
          }`}>
            <Cpu className="w-3.5 h-3.5" />
            <span>NATS</span>
            <span className={`w-1.5 h-1.5 rounded-full ${natsHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          </div>

          {/* Live WebSocket Stream HUD */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            wsStatus === 'connected'
              ? 'bg-cyan-950/40 border-cyan-800/40 text-cyan-400'
              : wsStatus === 'connecting'
              ? 'bg-amber-950/40 border-amber-800/40 text-amber-400'
              : 'bg-slate-850 border-slate-750 text-slate-400'
          }`}>
            <Wifi className="w-3.5 h-3.5" />
            <span>Live WS</span>
            <span className={`w-1.5 h-1.5 rounded-full ${
              wsStatus === 'connected' ? 'bg-neon-cyan animate-ping' : wsStatus === 'connecting' ? 'bg-amber-400 animate-bounce' : 'bg-slate-500'
            }`} />
          </div>
        </div>
      </div>

      {/* Controls: Time presets & Auto-refresh */}
      <div className="flex items-center gap-3">
        {/* Time Presets */}
        <div className="flex items-center bg-carbon-850 p-1 rounded-lg border border-slate-800">
          {(Object.keys(TIME_RANGE_CONFIGS) as TimeRangePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => onTimeRangeChange(preset)}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                timeRange === preset
                  ? 'bg-neon-cyan/20 text-neon-cyan font-semibold shadow-sm border border-neon-cyan/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Auto Refresh Interval */}
        <div className="flex items-center bg-carbon-850 rounded-lg border border-slate-800 px-2 py-1 text-xs font-mono text-slate-300">
          <span className="text-slate-500 mr-2">Sync:</span>
          <select
            value={refreshInterval}
            onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
            className="bg-transparent text-slate-200 outline-none cursor-pointer"
          >
            <option value={5000} className="bg-carbon-900">5s</option>
            <option value={10000} className="bg-carbon-900">10s</option>
            <option value={30000} className="bg-carbon-900">30s</option>
            <option value={60000} className="bg-carbon-900">1m</option>
            <option value={0} className="bg-carbon-900">Off</option>
          </select>
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={onManualRefresh}
          title="Refresh All Metrics"
          disabled={isRefreshing}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-carbon-850 border border-slate-800 hover:border-neon-cyan/40 hover:text-neon-cyan text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-neon-cyan' : ''}`} />
        </button>
      </div>
    </header>
  );
};
