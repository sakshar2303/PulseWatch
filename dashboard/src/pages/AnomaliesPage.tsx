import React from 'react';
import { Anomaly } from '../types';
import { AnomalyFeed } from '../components/alerts/AnomalyFeed';
import { StatCard } from '../components/common/StatCard';
import { AlertOctagon, ShieldAlert, CheckCircle2, Flame } from 'lucide-react';

interface AnomaliesPageProps {
  anomalies: Anomaly[];
  onAnomalyResolved?: (id: number) => void;
}

export const AnomaliesPage: React.FC<AnomaliesPageProps> = ({
  anomalies,
  onAnomalyResolved,
}) => {
  const criticalCount = anomalies.filter((a) => a.severity === 'critical' && !a.resolved_at).length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning' && !a.resolved_at).length;
  const resolvedCount = anomalies.filter((a) => !!a.resolved_at).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Overview Banner */}
      <div className="hud-panel rounded-xl p-6 border border-slate-850 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Anomaly & Incident Center</h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Threshold breaches and Machine Learning (Isolation Forest) behavioral deviations.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Critical Unresolved"
          value={criticalCount}
          subtitle="Immediate action required"
          icon={Flame}
          color={criticalCount > 0 ? 'rose' : 'emerald'}
        />

        <StatCard
          title="Active Warnings"
          value={warningCount}
          subtitle="Degraded metrics"
          icon={AlertOctagon}
          color="amber"
        />

        <StatCard
          title="Resolved Anomalies"
          value={resolvedCount}
          subtitle="Closed incidents"
          icon={CheckCircle2}
          color="emerald"
        />

        <StatCard
          title="Total Recorded"
          value={anomalies.length}
          subtitle="Historical incidents"
          icon={ShieldAlert}
          color="violet"
        />
      </div>

      {/* Main Feed */}
      <AnomalyFeed
        anomalies={anomalies}
        onAnomalyResolved={onAnomalyResolved}
      />
    </div>
  );
};
