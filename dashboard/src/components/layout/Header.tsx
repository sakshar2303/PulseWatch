import { RefreshCw, ExternalLink, Search } from 'lucide-react';
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
  onOpenCommandPalette?: () => void;
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
  onOpenCommandPalette,
}) => {
  const tsdbHealthy = health?.dependencies?.timescaledb?.status === 'healthy';
  const natsHealthy = health?.dependencies?.nats?.status === 'healthy';
  const allHealthy = tsdbHealthy && natsHealthy && wsStatus === 'connected';

  return (
    <header className="h-14 border-b border-white/[0.07] bg-void/90 backdrop-blur-xl px-5 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Brand & Breadcrumb */}
      <div className="flex items-center gap-4">
        {/* Brand Icon */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-omium-coral/15 border border-omium-coral/30 flex items-center justify-center text-omium-coral shadow-omium-glow">
            <span className="font-mono font-bold text-xs">PW</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white font-sans">PulseWatch</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-omium-secondary border border-white/10">
              v1.0-omium
            </span>
          </div>
        </div>

        {/* Breadcrumb Path */}
        <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-omium-tertiary pl-4 border-l border-white/[0.08]">
          <span className="text-omium-secondary hover:text-white cursor-pointer transition-colors">prod-cluster</span>
          <span>/</span>
          <span className="text-omium-coral font-medium">ground-truth-verifier</span>
        </div>

        {/* Live Ground-Truth Status Pill */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-void-card border border-white/[0.08] text-xs font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${allHealthy ? 'bg-omium-emerald animate-pulse' : 'bg-omium-coral animate-ping'}`} />
          <span className="text-white text-[11px] font-medium">
            {allHealthy ? 'Watching writes · 0 silent failures' : 'Pipeline initializing...'}
          </span>
        </div>
      </div>

      {/* Right: Tracing, Time Presets & Auto-refresh */}
      <div className="flex items-center gap-2.5">
        {/* Command Palette Trigger */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            title="Open Command Palette (Cmd + K)"
            className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-void-card hover:bg-void-elevated border border-white/10 text-xs font-mono text-omium-secondary hover:text-white transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-omium-coral" />
            <span>Search</span>
            <kbd className="text-[10px] bg-white/5 px-1 py-0.2 rounded border border-white/10 text-omium-tertiary">⌘K</kbd>
          </button>
        )}

        {/* Jaeger Distributed Traces Link */}
        <a
          href="http://localhost:16686"
          target="_blank"
          rel="noreferrer"
          title="Open Jaeger Distributed Traces"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-void-card hover:bg-void-elevated border border-white/10 hover:border-omium-sky/40 text-xs font-mono text-omium-sky transition-colors"
        >
          <span>Jaeger UI</span>
          <ExternalLink className="w-3 h-3 text-omium-sky" />
        </a>

        {/* Time Presets */}
        <div className="flex items-center bg-void-card p-0.5 rounded-lg border border-white/[0.08]">
          {(Object.keys(TIME_RANGE_CONFIGS) as TimeRangePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => onTimeRangeChange(preset)}
              className={`px-2 py-1 text-xs font-mono rounded-md transition-all ${
                timeRange === preset
                  ? 'bg-omium-coral/20 text-omium-coral font-semibold border border-omium-coral/30 shadow-sm'
                  : 'text-omium-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Auto Refresh Interval */}
        <div className="hidden sm:flex items-center bg-void-card rounded-lg border border-white/[0.08] px-2 py-1 text-xs font-mono text-omium-secondary">
          <span className="text-omium-tertiary mr-1.5">Sync:</span>
          <select
            value={refreshInterval}
            onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
            className="bg-transparent text-white outline-none cursor-pointer text-xs"
          >
            <option value={5000} className="bg-void-card">5s</option>
            <option value={10000} className="bg-void-card">10s</option>
            <option value={30000} className="bg-void-card">30s</option>
            <option value={60000} className="bg-void-card">1m</option>
            <option value={0} className="bg-void-card">Off</option>
          </select>
        </div>

        {/* Manual Refresh Button */}
        <button
          onClick={onManualRefresh}
          title="Refresh All Metrics"
          disabled={isRefreshing}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-void-card border border-white/[0.08] hover:border-omium-coral/40 hover:text-omium-coral text-omium-secondary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-omium-coral' : ''}`} />
        </button>
      </div>
    </header>
  );
};
