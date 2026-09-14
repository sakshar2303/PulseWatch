import React from 'react';
import {
  LayoutDashboard,
  Radio,
  LineChart,
  Server,
  AlertOctagon,
  Filter,
} from 'lucide-react';
import { HostInfo, ServiceInfo } from '../../types';

export type ActivePage = 'overview' | 'live' | 'explorer' | 'fleet' | 'anomalies';

interface SidebarProps {
  activePage: ActivePage;
  onPageChange: (page: ActivePage) => void;
  hosts: HostInfo[];
  services: ServiceInfo[];
  selectedHost: string;
  onHostChange: (host: string) => void;
  selectedService: string;
  onServiceChange: (service: string) => void;
  unresolvedAnomalyCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onPageChange,
  hosts,
  services,
  selectedHost,
  onHostChange,
  selectedService,
  onServiceChange,
  unresolvedAnomalyCount,
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'live', label: 'Live Stream', icon: Radio, pulse: true },
    { id: 'explorer', label: 'Metric Explorer', icon: LineChart },
    { id: 'fleet', label: 'Fleet & Nodes', icon: Server, badge: hosts.length },
    {
      id: 'anomalies',
      label: 'Anomalies',
      icon: AlertOctagon,
      alertBadge: unresolvedAnomalyCount,
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-850 bg-carbon-900/60 backdrop-blur-md flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] sticky top-16 z-20">
      <div className="p-4 space-y-6">
        {/* Navigation Links */}
        <div className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Monitoring
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id as ActivePage)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30 shadow-sm shadow-neon-cyan/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-neon-cyan' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.pulse && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-cyan" />
                  </span>
                )}

                {item.badge !== undefined && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {item.badge}
                  </span>
                )}

                {item.alertBadge !== undefined && item.alertBadge > 0 && (
                  <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                    {item.alertBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Global Filter Section */}
        <div className="pt-4 border-t border-slate-800/60 space-y-3">
          <div className="flex items-center gap-1.5 px-3 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <Filter className="w-3 h-3" />
            <span>Scope Filter</span>
          </div>

          {/* Host Filter */}
          <div className="px-3 space-y-1">
            <label className="text-xs text-slate-400 font-mono block">Host</label>
            <select
              value={selectedHost}
              onChange={(e) => onHostChange(e.target.value)}
              className="w-full bg-carbon-850 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-2 outline-none focus:border-neon-cyan/50"
            >
              <option value="">All Hosts ({hosts.length})</option>
              {hosts.map((h) => (
                <option key={h.name} value={h.name}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service Filter */}
          <div className="px-3 space-y-1">
            <label className="text-xs text-slate-400 font-mono block">Service</label>
            <select
              value={selectedService}
              onChange={(e) => onServiceChange(e.target.value)}
              className="w-full bg-carbon-850 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-2 outline-none focus:border-neon-cyan/50"
            >
              <option value="">All Services ({services.length})</option>
              {services.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-850 text-[11px] font-mono text-slate-500 flex items-center justify-between">
        <span>TimescaleDB 16</span>
        <span className="text-neon-cyan/70">NATS JetStream</span>
      </div>
    </aside>
  );
};
