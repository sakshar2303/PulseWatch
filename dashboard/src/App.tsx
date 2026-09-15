import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar, ActivePage } from './components/layout/Sidebar';
import { OverviewPage } from './pages/OverviewPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { FleetPage } from './pages/FleetPage';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { AuditPage } from './pages/AuditPage';
import { CheckpointsFeed } from './components/omium/CheckpointsFeed';
import { ServiceMap } from './components/omium/ServiceMap';
import { SLOSection } from './components/omium/SLOSection';
import { CommandPalette } from './components/common/CommandPalette';
import { LiveStreamChart } from './components/charts/LiveStreamChart';
import { useFleet } from './hooks/useFleet';
import { useLiveStream } from './hooks/useLiveStream';
import { TimeRangePreset } from './types';
import { wsService, ConnectionStatus } from './services/websocket';

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<ActivePage>('overview');
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('1h');
  const [refreshInterval, setRefreshInterval] = useState<number>(10000);
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>(wsService.getStatus());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Fleet data
  const {
    health,
    services,
    hosts,
    anomalies,
    metricNames,
    refreshFleet,
  } = useFleet(refreshInterval);

  // Dedicated full live stream for the "live" page
  const liveStream = useLiveStream({
    host: selectedHost,
    service: selectedService,
    maxPoints: 100,
  });

  useEffect(() => {
    const unsub = wsService.onStatus((status) => {
      setWsStatus(status);
    });
    // Auto-connect on app mount
    wsService.connect();
    return () => unsub();
  }, []);

  // Global Cmd + K / Ctrl + K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshFleet();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleAnomalyResolved = (_id: number) => {
    refreshFleet();
  };

  const unresolvedCount = anomalies.filter((a) => !a.resolved_at).length;

  return (
    <div className="min-h-screen bg-void text-white flex flex-col font-sans selection:bg-omium-coral/30 selection:text-white">
      {/* Header */}
      <Header
        health={health}
        wsStatus={wsStatus}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        refreshInterval={refreshInterval}
        onRefreshIntervalChange={setRefreshInterval}
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Body */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar
          activePage={activePage}
          onPageChange={setActivePage}
          hosts={hosts}
          services={services}
          selectedHost={selectedHost}
          onHostChange={setSelectedHost}
          selectedService={selectedService}
          onServiceChange={setSelectedService}
          unresolvedAnomalyCount={unresolvedCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {activePage === 'overview' && (
            <OverviewPage
              timeRange={timeRange}
              selectedHost={selectedHost}
              selectedService={selectedService}
              hosts={hosts}
              services={services}
              anomalies={anomalies}
              refreshInterval={refreshInterval}
              onAnomalyResolved={handleAnomalyResolved}
              onNavigateToCheckpoints={() => setActivePage('checkpoints')}
            />
          )}

          {activePage === 'checkpoints' && (
            <div className="space-y-6 pb-12">
              <CheckpointsFeed unresolvedAnomalyCount={unresolvedCount} />
            </div>
          )}

          {activePage === 'topology' && (
            <div className="space-y-6 pb-12">
              <ServiceMap />
            </div>
          )}

          {activePage === 'slo' && (
            <div className="space-y-6 pb-12">
              <SLOSection />
            </div>
          )}

          {activePage === 'audit' && (
            <div className="space-y-6 pb-12">
              <AuditPage />
            </div>
          )}

          {activePage === 'live' && (
            <div className="space-y-6 pb-12">
              <div className="hud-panel rounded-xl p-6 border border-white/5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-omium-coral/10 border border-omium-coral/20 text-omium-coral text-xs font-mono mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-omium-coral animate-ping" />
                  Live JetStream Stream
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">Full-Screen Real-Time Live Telemetry</h2>
                <p className="text-xs text-omium-secondary mt-1 font-mono">
                  Sub-millisecond metric events streaming directly from NATS JetStream via WebSocket.
                </p>
              </div>

              <LiveStreamChart
                points={liveStream.points}
                wsStatus={liveStream.status}
                lastTick={liveStream.lastTick}
                availableMetrics={metricNames.length > 0 ? metricNames : undefined}
                height={480}
              />
            </div>
          )}

          {activePage === 'explorer' && (
            <ExplorerPage
              availableMetrics={metricNames.length > 0 ? metricNames : ['cpu_usage_percent', 'memory_usage_percent', 'disk_usage_percent']}
              hosts={hosts}
              services={services}
              timeRange={timeRange}
              selectedHost={selectedHost}
              selectedService={selectedService}
            />
          )}

          {activePage === 'fleet' && (
            <FleetPage
              hosts={hosts}
              services={services}
              onRefresh={handleManualRefresh}
            />
          )}

          {activePage === 'anomalies' && (
            <AnomaliesPage
              anomalies={anomalies}
              onAnomalyResolved={handleAnomalyResolved}
            />
          )}
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(page) => setActivePage(page)}
      />
    </div>
  );
};
