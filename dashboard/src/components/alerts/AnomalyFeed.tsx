import React, { useState } from 'react';
import { Anomaly } from '../../types';
import { resolveAnomaly, triggerRemediation } from '../../services/api';
import { useToast } from '../common/Toast';
import { AlertOctagon, CheckCircle, Clock, Check, BrainCircuit, XCircle, ShieldCheck, Wrench } from 'lucide-react';

interface AnomalyFeedProps {
  anomalies: Anomaly[];
  onAnomalyResolved?: (id: number) => void;
}

export const AnomalyFeed: React.FC<AnomalyFeedProps> = ({
  anomalies,
  onAnomalyResolved,
}) => {
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'critical'>('all');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [remediatingId, setRemediatingId] = useState<number | null>(null);
  const toast = useToast();

  const filtered = anomalies.filter((a) => {
    if (filter === 'unresolved') return !a.resolved_at;
    if (filter === 'critical') return a.severity === 'critical';
    return true;
  });

  const handleResolve = async (id: number) => {
    setResolvingId(id);
    try {
      await resolveAnomaly(id);
      toast.success(`Anomaly #${id} resolved successfully`);
      if (onAnomalyResolved) onAnomalyResolved(id);
    } catch (err) {
      toast.error(`Failed to resolve anomaly #${id}`);
      console.error('Failed to resolve anomaly:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const handleRemediate = async (anomaly: Anomaly) => {
    setRemediatingId(anomaly.id);
    try {
      await triggerRemediation({
        service: anomaly.service,
        host: anomaly.host,
        metric_name: anomaly.metric_name,
        current_value: anomaly.value,
        description: anomaly.description,
        severity: anomaly.severity,
        anomaly_id: anomaly.id,
        rca_summary: anomaly.rca_summary || undefined,
      });
      toast.info(`Auto-remediation triggered for ${anomaly.service}`);
    } catch (err) {
      toast.error(`Remediation failed for ${anomaly.service}`);
      console.error('Failed to trigger remediation:', err);
    } finally {
      setRemediatingId(null);
    }
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 glow-rose">
            Critical
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Warning
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-sky-500/20 text-sky-400 border border-sky-500/30">
            Info
          </span>
        );
    }
  };

  return (
    <div className="hud-panel rounded-xl p-5 border border-slate-850 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-white tracking-wide">
            Anomalies & Alerts ({anomalies.length})
          </h3>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center bg-carbon-850 rounded-lg border border-slate-800 p-0.5 text-xs font-mono">
          {(['all', 'unresolved', 'critical'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 rounded capitalize ${
                filter === tab
                  ? 'bg-slate-700/60 text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Feed list */}
      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-slate-500 flex flex-col items-center justify-center gap-2">
            <CheckCircle className="w-6 h-6 text-emerald-500/50" />
            <span>No anomalies match the selected filter. Systems nominal.</span>
          </div>
        ) : (
          filtered.map((anomaly) => {
            const isResolved = !!anomaly.resolved_at;
            return (
              <div
                key={anomaly.id}
                className={`p-3 rounded-lg border transition-all text-xs ${
                  isResolved
                    ? 'bg-slate-900/30 border-slate-850 opacity-60'
                    : 'bg-carbon-850/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {severityBadge(anomaly.severity)}
                      <span className="font-mono text-slate-200 font-semibold">
                        {anomaly.metric_name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {anomaly.host}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {anomaly.service}
                      </span>
                    </div>

                    <p className="text-slate-300 text-xs">{anomaly.description}</p>

                    {/* AI Verification Badge */}
                    {anomaly.metadata?.llm_verified !== undefined && (
                      <div className={`mt-2 p-2.5 rounded-lg border ${
                        anomaly.metadata.llm_verified 
                          ? 'border-emerald-500/20 bg-emerald-950/20' 
                          : 'border-slate-500/20 bg-slate-800/50'
                      }`}>
                        <div className="flex items-start gap-2">
                          {anomaly.metadata.llm_verified ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgb(52 211 153 / 0.7))' }} />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          )}
                          <div>
                            <p className={`text-[10px] font-mono font-semibold uppercase tracking-wider mb-0.5 ${
                              anomaly.metadata.llm_verified ? 'text-emerald-400' : 'text-slate-400'
                            }`}>
                              {anomaly.metadata.llm_verified ? 'Verified by AI' : 'Rejected by AI (False Positive)'}
                            </p>
                            {anomaly.metadata.llm_reason && (
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                {anomaly.metadata.llm_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI Root Cause Analysis */}
                    {anomaly.rca_summary && (
                      <div className="mt-2 p-2.5 rounded-lg border border-violet-500/20 bg-violet-950/20">
                        <div className="flex items-start gap-2">
                          <BrainCircuit className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgb(139 92 246 / 0.7))' }} />
                          <div>
                            <p className="text-[10px] font-mono text-violet-400 font-semibold uppercase tracking-wider mb-0.5">AI Root Cause Analysis</p>
                            <p className="text-[11px] text-slate-300 leading-relaxed">{anomaly.rca_summary}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
                      <span>Value: <strong className="text-white">{anomaly.value.toFixed(1)}</strong></span>
                      {anomaly.threshold !== null && anomaly.threshold !== undefined && (
                        <span>Threshold: <strong className="text-rose-400">{anomaly.threshold.toFixed(1)}</strong></span>
                      )}
                      {anomaly.score !== null && anomaly.score !== undefined && (
                        <span>Score: <strong className="text-amber-400">{anomaly.score.toFixed(2)}</strong></span>
                      )}
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3" />
                        {new Date(anomaly.detected_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  {!isResolved ? (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleRemediate(anomaly)}
                        disabled={remediatingId === anomaly.id}
                        className="px-2.5 py-1 rounded bg-pulse-blue/10 hover:bg-pulse-blue/20 hover:border-pulse-blue/50 border border-pulse-blue/30 text-[11px] font-mono text-pulse-blue transition-all flex items-center justify-center gap-1 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>{remediatingId === anomaly.id ? 'Starting...' : 'Remediate'}</span>
                      </button>
                      <button
                        onClick={() => handleResolve(anomaly.id)}
                        disabled={resolvingId === anomaly.id}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-950/60 hover:text-emerald-400 hover:border-emerald-800/40 border border-slate-750 text-[11px] font-mono text-slate-300 transition-all flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>{resolvingId === anomaly.id ? 'Resolving...' : 'Resolve'}</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-mono text-emerald-400/80 px-2 py-0.5 rounded bg-emerald-950/30 border border-emerald-900/30 shrink-0">
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
