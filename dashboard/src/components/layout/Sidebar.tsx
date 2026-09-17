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
  ChevronDown,
  PanelLeftClose,
} from 'lucide-react';
import { HostInfo, ServiceInfo } from '../../types';

export type ActivePage = 'welcome' | 'overview' | 'checkpoints' | 'topology' | 'slo' | 'audit' | 'live' | 'explorer' | 'fleet' | 'anomalies' | 'diagnostics' | 'chaos' | 'remediation';

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
  onCollapse?: () => void;
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
  onCollapse,
}) => {
  const navItems = [
    { id: 'welcome', label: 'Welcome & Tour', icon: Sparkles, badgeText: 'Tour' },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'checkpoints', label: 'Live Checkpoints', icon: CheckCircle2, pulse: true, badgeText: 'Verify' },
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
    { id: 'remediation', label: 'Auto-Remediation', icon: ShieldCheck, badgeText: 'AI' },
  ];

  return (
    <aside className="w-60 border-r border-white/[0.07] bg-void/70 backdrop-blur-xl flex flex-col justify-between shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 z-20">
      <div className="p-3.5 space-y-5">
        {/* Navigation Links */}
        <div className="space-y-1">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-pulse-tertiary flex items-center justify-between">
            <span>Diagnostics & Verifier</span>
            {onCollapse && (
              <button
                onClick={onCollapse}
                title="Slide sidebar inside (Ctrl+B)"
                className="p-1 rounded hover:bg-white/5 text-pulse-tertiary hover:text-white transition-colors"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
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
                    ? 'bg-pulse-coral/15 text-pulse-coral font-semibold border border-pulse-coral/30 shadow-sm shadow-pulse-coral/10'
                    : 'text-pulse-secondary hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-pulse-coral' : 'text-pulse-tertiary'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.pulse && (
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pulse-coral opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-pulse-coral" />
                    </span>
                  )}

                  {item.badgeText && (
                    <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-pulse-coral/10 text-pulse-coral border border-pulse-coral/20">
                      {item.badgeText}
                    </span>
                  )}

                  {item.badge !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-void-card border border-white/5 text-pulse-tertiary">
                      {item.badge}
                    </span>
                  )}

                  {item.alertBadge !== undefined && item.alertBadge > 0 && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-pulse-rose/20 text-pulse-rose border border-pulse-rose/30 animate-pulse">
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
          <div className="flex items-center gap-1.5 px-3 text-[10px] font-mono uppercase tracking-wider text-pulse-tertiary">
            <Filter className="w-3 h-3" />
            <span>Telemetry Scope</span>
          </div>

          {/* Host Filter */}
          <div className="px-3 space-y-1">
            <label className="text-[11px] text-pulse-tertiary font-mono block">Host</label>
            <div className="relative">
              <select
                value={selectedHost}
                onChange={(e) => onHostChange(e.target.value)}
                className="w-full appearance-none bg-[#0D0F12] border border-white/[0.1] text-white text-xs rounded-lg pl-2.5 pr-8 py-2 outline-none focus:border-pulse-coral/50 font-mono cursor-pointer transition-colors hover:border-white/20"
              >
                <option value="" className="bg-[#0D0F12] text-white">All Hosts ({hosts.length})</option>
                {hosts.map((h) => (
                  <option key={h.name} value={h.name} className="bg-[#0D0F12] text-white">
                    {h.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-pulse-tertiary absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Service Filter */}
          <div className="px-3 space-y-1">
            <label className="text-[11px] text-pulse-tertiary font-mono block">Service</label>
            <div className="relative">
              <select
                value={selectedService}
                onChange={(e) => onServiceChange(e.target.value)}
                className="w-full appearance-none bg-[#0D0F12] border border-white/[0.1] text-white text-xs rounded-lg pl-2.5 pr-8 py-2 outline-none focus:border-pulse-coral/50 font-mono cursor-pointer transition-colors hover:border-white/20"
              >
                <option value="" className="bg-[#0D0F12] text-white">All Services ({services.length})</option>
                {services.map((s) => (
                  <option key={s.name} value={s.name} className="bg-[#0D0F12] text-white">
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-pulse-tertiary absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-white/[0.06] text-[10px] font-mono text-pulse-tertiary flex items-center justify-between">
        <span className="text-pulse-secondary">TimescaleDB Hypertable</span>
        <span className="text-pulse-coral font-medium">NATS JetStream</span>
      </div>
    </aside>
  );
};
