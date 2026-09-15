import React from 'react';
import {
  LayoutDashboard,
  Radio,
  LineChart,
  Server,
  AlertOctagon,
  ShieldCheck,
  CheckCircle2,
  Filter,
  Network,
  FileCheck,
  Sparkles,
  Cpu,
  Zap,
} from 'lucide-react';
import { HostInfo, ServiceInfo } from '../../types';

export type ActivePage = 'welcome' | 'overview' | 'checkpoints' | 'topology' | 'slo' | 'audit' | 'live' | 'explorer' | 'fleet' | 'anomalies' | 'diagnostics' | 'chaos';

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
    { id: 'welcome', label: 'Welcome & Tour', icon: Sparkles, badgeText: 'Tour' },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'checkpoints', label: 'Live Checkpoints', icon: CheckCircle2, pulse: true, badgeText: 'Omium' },
    { id: 'topology', label: 'Service Topology', icon: Network },
    { id: 'slo', label: 'SLO Reliability', icon: ShieldCheck },
    { id: 'diagnostics', label: 'Agent Diagnostics', icon: Cpu, badgeText: 'New' },
    { id: 'chaos', label: 'Chaos Lab', icon: Zap, badgeText: 'Lab' },
    { id: 'audit', label: 'Failure Audit Proof', icon: FileCheck, badgeText: 'Proof' },
    { id: 'live', label: 'Live Telemetry', icon: Radio },
    { id: 'explorer', label: 'Metric Explorer', icon: LineChart },
    { id: 'fleet', label: 'Fleet & Agents', icon: Server, badge: hosts.length },
    {
      id: 'anomalies',
      label: 'Anomalies & Audits',
      icon: AlertOctagon,
      alertBadge: unresolvedAnomalyCount,
    },
  ];

  return (
    <aside className="w-60 border-r border-white/[0.07] bg-void/70 backdrop-blur-xl flex flex-col justify-between shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 z-20">
      <div className="p-3.5 space-y-5">
        {/* Navigation Links */}
        <div className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-omium-tertiary">
            Diagnostics & Verifier
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id as ActivePage)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-omium-coral/15 text-omium-coral font-semibold border border-omium-coral/30 shadow-sm shadow-omium-coral/10'
                    : 'text-omium-secondary hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-omium-coral' : 'text-omium-tertiary'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.pulse && (
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-omium-coral opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-omium-coral" />
                    </span>
                  )}

                  {item.badgeText && (
                    <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-omium-coral/10 text-omium-coral border border-omium-coral/20">
                      {item.badgeText}
                    </span>
                  )}

                  {item.badge !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-void-card border border-white/5 text-omium-tertiary">
                      {item.badge}
                    </span>
                  )}

                  {item.alertBadge !== undefined && item.alertBadge > 0 && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-omium-rose/20 text-omium-rose border border-omium-rose/30 animate-pulse">
                      {item.alertBadge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Scope Filter Section */}
        <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
          <div className="flex items-center gap-1.5 px-3 text-[10px] font-mono uppercase tracking-wider text-omium-tertiary">
            <Filter className="w-3 h-3" />
            <span>Telemetry Scope</span>
          </div>

          {/* Host Filter */}
          <div className="px-3 space-y-1">
            <label className="text-[11px] text-omium-tertiary font-mono block">Host</label>
            <select
              value={selectedHost}
              onChange={(e) => onHostChange(e.target.value)}
              className="w-full bg-void-card border border-white/[0.08] text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-omium-coral/50 font-mono"
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
            <label className="text-[11px] text-omium-tertiary font-mono block">Service</label>
            <select
              value={selectedService}
              onChange={(e) => onServiceChange(e.target.value)}
              className="w-full bg-void-card border border-white/[0.08] text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-omium-coral/50 font-mono"
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
      <div className="p-3.5 border-t border-white/[0.06] text-[10px] font-mono text-omium-tertiary flex items-center justify-between">
        <span className="text-omium-secondary">TimescaleDB Hypertable</span>
        <span className="text-omium-coral font-medium">NATS JetStream</span>
      </div>
    </aside>
  );
};
