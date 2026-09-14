import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar, ActivePage } from './components/layout/Sidebar';
import { OverviewPage } from './pages/OverviewPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { FleetPage } from './pages/FleetPage';
import { AnomaliesPage } from './pages/AnomaliesPage';
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
    <div className="min-h-screen bg-carbon-950 flex flex-col">
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
            />
          )}

          {activePage === 'live' && (
            <div className="space-y-6 pb-12">
              <div className="hud-panel rounded-xl p-6 border border-slate-850">
                <h2 className="text-lg font-bold text-white tracking-tight">Full-Screen Real-Time Live Telemetry</h2>
                <p className="text-xs text-slate-400 mt-1 font-mono">
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
    </div>
  );
};
