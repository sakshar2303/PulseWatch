import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  color = 'cyan',
  trend,
}) => {
  const colorMap = {
    cyan: {
      border: 'hover:border-neon-cyan/40',
      iconBg: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20',
      glow: 'glow-cyan',
      text: 'text-neon-cyan',
    },
    emerald: {
      border: 'hover:border-neon-emerald/40',
      iconBg: 'bg-neon-emerald/10 text-neon-emerald border-neon-emerald/20',
      glow: 'glow-emerald',
      text: 'text-neon-emerald',
    },
    amber: {
      border: 'hover:border-neon-amber/40',
      iconBg: 'bg-neon-amber/10 text-neon-amber border-neon-amber/20',
      glow: '',
      text: 'text-neon-amber',
    },
    rose: {
      border: 'hover:border-neon-rose/40',
      iconBg: 'bg-neon-rose/10 text-neon-rose border-neon-rose/20',
      glow: 'glow-rose',
      text: 'text-neon-rose',
    },
    violet: {
      border: 'hover:border-neon-violet/40',
      iconBg: 'bg-neon-violet/10 text-neon-violet border-neon-violet/20',
      glow: '',
      text: 'text-neon-violet',
    },
  };

  const scheme = colorMap[color];

  return (
    <div className={`hud-panel hud-panel-interactive rounded-xl p-5 border border-slate-800/80 transition-all ${scheme.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${scheme.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-mono font-bold tracking-tight text-white">{value}</span>
        {unit && <span className="text-sm font-mono text-slate-400">{unit}</span>}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        {subtitle && <span className="text-slate-400 font-mono">{subtitle}</span>}
        {trend && (
          <span className={`font-mono font-medium ${trend.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend.isPositive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
    </div>
  );
};
