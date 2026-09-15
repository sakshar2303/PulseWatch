import React, { useState } from 'react';
import { Play, RotateCcw, AlertTriangle, Zap, ShieldCheck } from 'lucide-react';

interface ScenarioSimulatorProps {
  onSimulateFailure?: () => void;
  onSimulateBurst?: () => void;
  onSimulateAnomaly?: () => void;
  onReset?: () => void;
}

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({
  onSimulateFailure,
  onSimulateBurst,
  onSimulateAnomaly,
  onReset,
}) => {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleFailure = () => {
    setActiveScenario('failure');
    triggerToast('⚡ Injected Silent Failure: supportAgent reported invoice created, but 0 rows landed in TimescaleDB. Triggering PulseWatch auto-recovery replay...');
    if (onSimulateFailure) onSimulateFailure();
  };

  const handleBurst = () => {
    setActiveScenario('burst');
    triggerToast('🚀 Injected Telemetry Spike: 2,000 pts/sec burst over 20 hosts. NATS JetStream backpressure active; 0 drops.');
    if (onSimulateBurst) onSimulateBurst();
  };

  const handleAnomaly = () => {
    setActiveScenario('anomaly');
    triggerToast('⚠️ Injected CPU Load Anomaly: web-server-01 spiked to 98.4% CPU. Isolation Forest ML model flagged anomaly (score=-0.42).');
    if (onSimulateAnomaly) onSimulateAnomaly();
  };

  const handleReset = () => {
    setActiveScenario(null);
    triggerToast('✓ Systems reset: All agent runs verified, nominal load restored, zero active anomalies.');
    if (onReset) onReset();
  };

  return (
    <div className="hud-panel rounded-xl p-4 border border-white/[0.08] bg-void-card relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-pulse-coral/15 border border-pulse-coral/30 flex items-center justify-center text-pulse-coral">
            <Zap className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Live Scenario & Chaos Simulator
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-pulse-coral/10 text-pulse-coral border border-pulse-coral/20">
                Demo Mode
              </span>
            </div>
            <p className="text-[11px] text-pulse-secondary">
              Inject failure events on demand to demonstrate self-healing, ML detection, and NATS JetStream backpressure.
            </p>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <button
            onClick={handleFailure}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              activeScenario === 'failure'
                ? 'bg-pulse-coral/25 border-pulse-coral text-pulse-coral font-bold shadow-pulse-glow'
                : 'bg-void-card hover:bg-void-elevated border-white/10 text-pulse-coral hover:border-pulse-coral/40'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Inject Silent Failure</span>
          </button>

          <button
            onClick={handleBurst}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              activeScenario === 'burst'
                ? 'bg-pulse-sky/25 border-pulse-sky text-pulse-sky font-bold shadow-pulse-cyan'
                : 'bg-void-card hover:bg-void-elevated border-white/10 text-pulse-sky hover:border-pulse-sky/40'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Spike Load (2k pts/s)</span>
          </button>

          <button
            onClick={handleAnomaly}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              activeScenario === 'anomaly'
                ? 'bg-pulse-rose/25 border-pulse-rose text-pulse-rose font-bold shadow-sm'
                : 'bg-void-card hover:bg-void-elevated border-white/10 text-pulse-rose hover:border-pulse-rose/40'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Trigger ML Anomaly</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset simulation state"
            className="px-2.5 py-1.5 rounded-lg bg-void-card hover:bg-void-elevated border border-white/10 hover:border-white/20 text-pulse-secondary hover:text-white transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Floating Animated Toast */}
      {toastMessage && (
        <div className="mt-3 p-3 rounded-lg bg-void border border-pulse-coral/40 text-xs font-mono text-white flex items-center gap-2 shadow-pulse-glow animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-pulse-coral animate-ping shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
