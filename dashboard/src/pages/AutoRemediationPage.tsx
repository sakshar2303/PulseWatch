import React, { useEffect, useState } from 'react';
import { ShieldAlert, Activity, CheckCircle2, XCircle, Clock, Search, RotateCcw, Sparkles } from 'lucide-react';
import { Remediation, RemediationStats } from '../types';
import { fetchRemediations, fetchRemediationStats } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

export const AutoRemediationPage: React.FC = () => {
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [stats, setStats] = useState<RemediationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRemediation, setSelectedRemediation] = useState<Remediation | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rems, st] = await Promise.all([
        fetchRemediations(),
        fetchRemediationStats(),
      ]);
      setRemediations(rems);
      setStats(st);
    } catch (err: any) {
      console.error(err.message || 'Failed to load remediation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-400" />;
      case 'executing':
      case 'analyzing': return <Activity className="w-5 h-5 text-pulse-blue animate-pulse" />;
      case 'rolled_back': return <RotateCcw className="w-5 h-5 text-yellow-400" />;
      default: return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'executing':
      case 'analyzing': return 'bg-pulse-blue/10 text-pulse-blue border-pulse-blue/20';
      case 'rolled_back': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6 animate-fade-in relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-pulse-blue/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-pulse-coral" />
            Auto-Remediation
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm">
            Autonomous self-healing driven by LLM agents.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 z-10">
        {[
          { label: 'Total Actions', value: stats?.total_remediations ?? '-', desc: 'Lifetime execution count' },
          { label: 'Success Rate', value: stats ? `${stats.success_rate.toFixed(1)}%` : '-', desc: 'Resolution success rate' },
          { label: 'Autonomous Actions', value: stats?.autonomous_count ?? '-', desc: 'Zero-touch mitigations' },
          { label: 'Last 24h', value: stats?.last_24h ?? '-', desc: 'Actions in the last day' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 relative overflow-hidden group hover:border-pulse-blue/30 transition-colors">
            <div className="text-slate-400 text-sm font-mono mb-1">{stat.label}</div>
            <div className="text-3xl font-light text-white mb-2">{stat.value}</div>
            <div className="text-xs text-slate-500">{stat.desc}</div>
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-pulse-blue/10 to-transparent blur-xl group-hover:scale-150 transition-transform duration-500" />
          </div>
        ))}
      </div>

      <div className="flex flex-1 gap-6 z-10 overflow-hidden min-h-0">
        {/* Remediation List */}
        <div className="w-1/2 flex flex-col min-h-0 glass-panel overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
            <h2 className="text-lg font-medium text-white/90">Action History</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-black/20 border border-white/10 rounded-md py-1.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pulse-blue/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading && !remediations.length ? (
              <div className="p-8 text-center text-slate-400 font-mono text-sm">Loading history...</div>
            ) : remediations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-mono text-sm">No remediation actions found.</div>
            ) : (
              remediations.map((rem) => (
                <div
                  key={rem.id}
                  onClick={() => setSelectedRemediation(rem)}
                  className={`p-4 rounded-lg cursor-pointer border transition-all duration-300 flex items-center gap-4
                    ${selectedRemediation?.id === rem.id 
                      ? 'bg-pulse-blue/10 border-pulse-blue/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-black/40'}`}
                >
                  <div className="flex-shrink-0">
                    {getStatusIcon(rem.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-white/90 truncate">{rem.action_type || 'Unknown Action'}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(rem.status)}`}>
                        {rem.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center justify-between">
                      <span className="truncate">{rem.service} • {rem.metric_name}</span>
                      <span>{formatDistanceToNow(new Date(rem.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Remediation Details */}
        <div className="w-1/2 flex flex-col min-h-0 glass-panel overflow-hidden">
          {selectedRemediation ? (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-light text-white">Action Details</h2>
                  <div className="flex gap-2">
                    <span className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300 font-mono">
                      ID: #{selectedRemediation.id}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-md border font-mono ${selectedRemediation.trigger_type === 'autonomous' ? 'bg-pulse-coral/10 text-pulse-coral border-pulse-coral/20' : 'bg-slate-500/10 text-slate-300 border-slate-500/20'}`}>
                      {selectedRemediation.trigger_type.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Target</div>
                    <div className="text-sm font-mono text-white/80">{selectedRemediation.service}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Metric</div>
                    <div className="text-sm font-mono text-white/80">{selectedRemediation.metric_name}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* AI Plan */}
                {selectedRemediation.llm_plan && (
                  <div>
                    <h3 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-pulse-blue" />
                      LLM Remediation Plan
                    </h3>
                    <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap">
                      {selectedRemediation.llm_plan}
                    </div>
                  </div>
                )}

                {/* Metrics Impact */}
                {(selectedRemediation.metric_before !== undefined || selectedRemediation.metric_after !== undefined) && (
                  <div>
                    <h3 className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Impact Assessment
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="glass-panel p-3 text-center">
                        <div className="text-xs text-slate-500 mb-1">Before Action</div>
                        <div className="text-lg font-mono text-white">
                          {selectedRemediation.metric_before !== null ? selectedRemediation.metric_before?.toFixed(2) : '-'}
                        </div>
                      </div>
                      <div className="glass-panel p-3 text-center border-emerald-500/20">
                        <div className="text-xs text-emerald-500/80 mb-1">After Action</div>
                        <div className="text-lg font-mono text-emerald-400">
                          {selectedRemediation.metric_after !== null ? selectedRemediation.metric_after?.toFixed(2) : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Execution Log */}
                {selectedRemediation.execution_log && (
                  <div>
                    <h3 className="text-sm font-medium text-white/80 mb-2">Execution Log</h3>
                    <div className="bg-black/50 border border-white/5 rounded-lg p-4 font-mono text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap">
                      {selectedRemediation.execution_log}
                    </div>
                  </div>
                )}
                
                {/* Action Payload */}
                {selectedRemediation.action_payload && (
                  <div>
                    <h3 className="text-sm font-medium text-white/80 mb-2">Action Payload</h3>
                    <pre className="bg-black/50 border border-white/5 rounded-lg p-4 font-mono text-xs text-slate-400 overflow-x-auto">
                      {JSON.stringify(selectedRemediation.action_payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-sm">
              Select an action to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
