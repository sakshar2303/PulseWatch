import React from 'react';
import { HostInfo, ServiceInfo } from '../types';
import { Server, Layers, Clock } from 'lucide-react';

interface FleetPageProps {
  hosts: HostInfo[];
  services: ServiceInfo[];
  onRefresh: () => void;
}

export const FleetPage: React.FC<FleetPageProps> = ({
  hosts,
  services,
  onRefresh,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Healthy</span>
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-950/40 text-amber-400 border border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Warning</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>Offline</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Overview Banner */}
      <div className="hud-panel rounded-xl p-6 border border-slate-850 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Fleet & Node Inventory</h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Active telemetry agents running across monitored infrastructure.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <div className="text-slate-400">Total Nodes</div>
            <div className="text-white font-bold text-base">{hosts.length}</div>
          </div>
          <div className="text-right pl-4 border-l border-slate-800">
            <div className="text-slate-400">Active Services</div>
            <div className="text-neon-cyan font-bold text-base">{services.length}</div>
          </div>
        </div>
      </div>

      {/* Hosts Table */}
      <div className="hud-panel rounded-xl p-5 border border-slate-850 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-850">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Server className="w-4 h-4 text-neon-cyan" />
            <span>Monitored Host Nodes ({hosts.length})</span>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs font-mono text-slate-400 hover:text-neon-cyan transition-colors"
          >
            Refresh Fleet
          </button>
        </div>

        {hosts.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-8 text-center">
            No active hosts reporting metrics yet. Start the Collector agent to see nodes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Node Hostname</th>
                  <th className="py-2.5 px-3">Service Role</th>
                  <th className="py-2.5 px-3">Heartbeat / Last Seen</th>
                  <th className="py-2.5 px-3">Health Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {hosts.map((h, i) => (
                  <tr key={i} className="hover:bg-carbon-850/50 transition-colors">
                    <td className="py-3 px-3 text-white font-medium flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-slate-500" />
                      <span>{h.name}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{h.service}</td>
                    <td className="py-3 px-3 text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{new Date(h.last_seen).toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(h.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Services Table */}
      <div className="hud-panel rounded-xl p-5 border border-slate-850 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-850 text-sm font-semibold text-white">
          <Layers className="w-4 h-4 text-neon-violet" />
          <span>Registered Services ({services.length})</span>
        </div>

        {services.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-8 text-center">
            No services registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Service Name</th>
                  <th className="py-2.5 px-3">Assigned Host Count</th>
                  <th className="py-2.5 px-3">Last Ingest Activity</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {services.map((s, i) => (
                  <tr key={i} className="hover:bg-carbon-850/50 transition-colors">
                    <td className="py-3 px-3 text-white font-medium">{s.name}</td>
                    <td className="py-3 px-3 text-slate-300">{s.host_count} hosts</td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(s.last_seen).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(s.status)}</td>
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
