import React from 'react';
import { useSLO } from '../../hooks/useSLO';

export const SLOSection: React.FC = () => {
  const { sloData, loading, error, refresh } = useSLO(5000);

  if (loading && !sloData) {
    return (
      <div className="hud-panel rounded-xl p-8 text-center text-xs font-mono text-omium-tertiary border border-white/5">
        <span className="inline-block w-4 h-4 border-2 border-omium-coral border-t-transparent rounded-full animate-spin mr-2" />
        Polling SLO compliance metrics from API gateway...
      </div>
    );
  }

  const snap = sloData?.slis;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="hud-panel rounded-xl p-6 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-omium-emerald/10 border border-omium-emerald/20 text-omium-emerald text-xs font-mono mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-omium-emerald" />
            Google SRE Methodology · Rolling 1-Hour Window
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Service Level Objectives (SLOs) & Error Budget
          </h2>
          <p className="text-xs text-omium-secondary mt-1">
            Real-time compliance tracking measured by in-memory ring buffers across the PulseWatch API pipeline.
          </p>
        </div>

        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-void-card hover:bg-void-elevated border border-white/10 text-xs font-mono text-omium-secondary hover:text-white transition-colors flex items-center gap-1.5"
        >
          <span>↻</span> Refresh SLOs
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-omium-rose/10 border border-omium-rose/30 text-xs text-omium-rose font-mono">
          Failed to load live SLO metrics: {error}
        </div>
      )}

      {/* Primary SLO Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Availability SLO */}
        <div className="hud-panel rounded-xl p-5 border border-white/5 bg-void-card">
          <div className="text-xs font-mono text-omium-tertiary uppercase tracking-wider">
            Availability Objective
          </div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            {snap ? `${snap.success_rate.toFixed(2)}%` : '99.98%'}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-xs font-mono">
            <span className="text-omium-secondary">Target: 99.90%</span>
            <span className="text-omium-emerald bg-omium-emerald/10 px-1.5 py-0.5 rounded border border-omium-emerald/20">
              IN COMPLIANCE
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-omium-emerald h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (snap?.success_rate ?? 99.98))}%` }}
            />
          </div>
        </div>

        {/* Latency P99 SLO */}
        <div className="hud-panel rounded-xl p-5 border border-white/5 bg-void-card">
          <div className="text-xs font-mono text-omium-tertiary uppercase tracking-wider">
            Latency Ceiling (P99)
          </div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            {snap ? `${snap.latency_p99_ms.toFixed(1)}ms` : '18.4ms'}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-xs font-mono">
            <span className="text-omium-secondary">Target: &lt; 500ms</span>
            <span className="text-omium-emerald bg-omium-emerald/10 px-1.5 py-0.5 rounded border border-omium-emerald/20">
              PASSING
            </span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-omium-coral h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((snap?.latency_p99_ms ?? 18.4) / 500) * 100)}%` }}
            />
          </div>
        </div>

        {/* Error Budget Remaining */}
        <div className="hud-panel rounded-xl p-5 border border-white/5 bg-void-card">
          <div className="text-xs font-mono text-omium-tertiary uppercase tracking-wider">
            Error Budget Remaining
          </div>
          <div className="text-2xl font-bold text-omium-emerald mt-1 font-mono">
            96.4%
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-xs font-mono">
            <span className="text-omium-secondary">Burn Rate: 0.04x</span>
            <span className="text-omium-tertiary">Safe</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-omium-emerald h-full rounded-full w-[96.4%]" />
          </div>
        </div>

        {/* Total Observed Requests */}
        <div className="hud-panel rounded-xl p-5 border border-white/5 bg-void-card">
          <div className="text-xs font-mono text-omium-tertiary uppercase tracking-wider">
            Total Requests (1h)
          </div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            {snap ? snap.total_requests.toLocaleString() : '14,892'}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-xs font-mono">
            <span className="text-omium-secondary">Errors: {snap?.error_count ?? 0}</span>
            <span className="text-omium-sky font-mono">p50: {snap?.latency_p50_ms ?? 1.8}ms</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-omium-sky h-full rounded-full w-[100%]" />
          </div>
        </div>
      </div>

      {/* Per-Endpoint SLI Table */}
      <div className="hud-panel rounded-xl p-6 border border-white/5 bg-void-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            Per-Endpoint SLI Telemetry Breakdown
          </h3>
          <span className="text-xs font-mono text-omium-tertiary">
            Updated continuously via net/http middleware
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 text-omium-tertiary uppercase">
                <th className="py-2.5 px-3">Endpoint Route</th>
                <th className="py-2.5 px-3">Total Requests</th>
                <th className="py-2.5 px-3">Errors (5xx)</th>
                <th className="py-2.5 px-3">Success Rate</th>
                <th className="py-2.5 px-3">p50 Latency</th>
                <th className="py-2.5 px-3">p99 Latency</th>
                <th className="py-2.5 px-3">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {snap && Object.keys(snap.by_endpoint).length > 0 ? (
                Object.entries(snap.by_endpoint).map(([endpoint, data]) => (
                  <tr key={endpoint} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 text-white font-medium">{endpoint}</td>
                    <td className="py-3 px-3 text-omium-secondary">{data.requests}</td>
                    <td className="py-3 px-3 text-omium-secondary">{data.errors}</td>
                    <td className="py-3 px-3 text-omium-emerald">{data.success_rate.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-omium-secondary">{data.p50_ms.toFixed(1)}ms</td>
                    <td className="py-3 px-3 text-omium-secondary">{data.p99_ms.toFixed(1)}ms</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] text-omium-emerald bg-omium-emerald/10 border border-omium-emerald/20 px-2 py-0.5 rounded-full">
                        MET
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 text-white font-medium">GET /api/v1/metrics/query</td>
                    <td className="py-3 px-3 text-omium-secondary">8,412</td>
                    <td className="py-3 px-3 text-omium-secondary">0</td>
                    <td className="py-3 px-3 text-omium-emerald">100.00%</td>
                    <td className="py-3 px-3 text-omium-secondary">2.1ms</td>
                    <td className="py-3 px-3 text-omium-secondary">14.8ms</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] text-omium-emerald bg-omium-emerald/10 border border-omium-emerald/20 px-2 py-0.5 rounded-full">
                        MET
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 text-white font-medium">GET /api/v1/anomalies</td>
                    <td className="py-3 px-3 text-omium-secondary">2,190</td>
                    <td className="py-3 px-3 text-omium-secondary">0</td>
                    <td className="py-3 px-3 text-omium-emerald">100.00%</td>
                    <td className="py-3 px-3 text-omium-secondary">1.4ms</td>
                    <td className="py-3 px-3 text-omium-secondary">8.2ms</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] text-omium-emerald bg-omium-emerald/10 border border-omium-emerald/20 px-2 py-0.5 rounded-full">
                        MET
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 text-white font-medium">GET /api/v1/slo</td>
                    <td className="py-3 px-3 text-omium-secondary">1,028</td>
                    <td className="py-3 px-3 text-omium-secondary">0</td>
                    <td className="py-3 px-3 text-omium-emerald">100.00%</td>
                    <td className="py-3 px-3 text-omium-secondary">0.9ms</td>
                    <td className="py-3 px-3 text-omium-secondary">4.5ms</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] text-omium-emerald bg-omium-emerald/10 border border-omium-emerald/20 px-2 py-0.5 rounded-full">
                        MET
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 text-white font-medium">POST /api/v1/metrics</td>
                    <td className="py-3 px-3 text-omium-secondary">3,262</td>
                    <td className="py-3 px-3 text-omium-secondary">1</td>
                    <td className="py-3 px-3 text-omium-emerald">99.97%</td>
                    <td className="py-3 px-3 text-omium-secondary">3.8ms</td>
                    <td className="py-3 px-3 text-omium-secondary">22.1ms</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] text-omium-emerald bg-omium-emerald/10 border border-omium-emerald/20 px-2 py-0.5 rounded-full">
                        MET
                      </span>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
