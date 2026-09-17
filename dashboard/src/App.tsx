import React, { useState, useEffect, lazy, Suspense } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { Header } from './components/layout/Header';
import { Sidebar, ActivePage } from './components/layout/Sidebar';
import { OverviewPage } from './pages/OverviewPage';
import { WelcomePage } from './pages/WelcomePage';
import { AnomaliesPage } from './pages/AnomaliesPage';
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal';
import { SkeletonPageFallback } from './components/common/Skeleton';
import { CheckpointsFeed } from './components/telemetry/CheckpointsFeed';
import { ServiceMap } from './components/telemetry/ServiceMap';
import { SLOSection } from './components/telemetry/SLOSection';
import { CommandPalette } from './components/common/CommandPalette';
import { LiveStreamChart } from './components/charts/LiveStreamChart';
import { useFleet } from './hooks/useFleet';
import { useLiveStream } from './hooks/useLiveStream';
import { TimeRangePreset } from './types';
import { wsService, ConnectionStatus } from './services/websocket';

// ─── Lazy-loaded heavy pages ────────────────────────────────────────────────
const ExplorerPage = lazy(() => import('./pages/ExplorerPage').then((m) => ({ default: m.ExplorerPage })));
const FleetPage = lazy(() => import('./pages/FleetPage').then((m) => ({ default: m.FleetPage })));
const AuditPage = lazy(() => import('./pages/AuditPage').then((m) => ({ default: m.AuditPage })));
const AgentDiagnosticsPage = lazy(() => import('./pages/AgentDiagnosticsPage').then((m) => ({ default: m.AgentDiagnosticsPage })));
const ChaosLabPage = lazy(() => import('./pages/ChaosLabPage').then((m) => ({ default: m.ChaosLabPage })));
const AutoRemediationPage = lazy(() => import('./pages/AutoRemediationPage').then((m) => ({ default: m.AutoRemediationPage })));

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<ActivePage>('welcome');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<TimeRangePreset>('1h');
  const [refreshInterval, setRefreshInterval] = useState<number>(10000);
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>(wsService.getStatus());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

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

  // Global Shortcuts: Cmd+K (palette), Cmd+B (sidebar toggle), ? (shortcuts help)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (activePage !== 'welcome') {
          setIsSidebarOpen((prev) => !prev);
        }
      }
      // '?' key for shortcuts help (only when not typing in an input)
      if (
        e.key === '?' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePage]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshFleet();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleAnomalyResolved = (_id: number) => {
    refreshFleet();
  };

  const unresolvedCount = anomalies.filter((a) => !a.resolved_at).length;

  // ─── Page Content Renderer ──────────────────────────────────────────────

  const renderPage = () => {
    switch (activePage) {
      case 'welcome':
        return <WelcomePage onNavigate={(p) => setActivePage(p)} />;

      case 'overview':
        return (
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
        );

      case 'checkpoints':
        return (
          <div className="space-y-6 pb-12">
            <CheckpointsFeed unresolvedAnomalyCount={unresolvedCount} />
          </div>
        );

      case 'topology':
        return (
          <div className="space-y-6 pb-12">
            <ServiceMap />
          </div>
        );

      case 'slo':
        return (
          <div className="space-y-6 pb-12">
            <SLOSection />
          </div>
        );

      case 'audit':
        return (
          <Suspense fallback={<SkeletonPageFallback />}>
            <div className="space-y-6 pb-12">
              <AuditPage />
            </div>
          </Suspense>
        );

      case 'diagnostics':
        return (
          <Suspense fallback={<SkeletonPageFallback />}>
            <div className="space-y-6 pb-12">
              <AgentDiagnosticsPage />
            </div>
          </Suspense>
        );

      case 'chaos':
        return (
          <Suspense fallback={<SkeletonPageFallback />}>
            <div className="space-y-6 pb-12">
              <ChaosLabPage />
            </div>
          </Suspense>
        );

      case 'live':
        return (
          <div className="space-y-6 pb-12">
            <div className="hud-panel rounded-xl p-6 border border-white/5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-pulse-coral/10 border border-pulse-coral/20 text-pulse-coral text-xs font-mono mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pulse-coral animate-ping" />
                Live JetStream Stream
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">Full-Screen Real-Time Live Telemetry</h2>
              <p className="text-xs text-pulse-secondary mt-1 font-mono">
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
        );

      case 'explorer':
        return (
          <Suspense fallback={<SkeletonPageFallback />}>
            <ExplorerPage
              availableMetrics={metricNames.length > 0 ? metricNames : ['cpu_usage_percent', 'memory_usage_percent', 'disk_usage_percent']}
              hosts={hosts}
              services={services}
              timeRange={timeRange}
              selectedHost={selectedHost}
              selectedService={selectedService}
            />
          </Suspense>
        );

      case 'fleet':
        return (
          <Suspense fallback={<SkeletonPageFallback />}>
            <FleetPage
              hosts={hosts}
              services={services}
              onRefresh={handleManualRefresh}
            />
          </Suspense>
        );

      case 'anomalies':
        return (
          <AnomaliesPage
            anomalies={anomalies}
            onAnomalyResolved={handleAnomalyResolved}
          />
        );

      case 'remediation':
        return (
          <Suspense fallback={<SkeletonPageFallback />}>
            <AutoRemediationPage />
          </Suspense>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-void text-white flex flex-col font-sans selection:bg-pulse-coral/30 selection:text-white">
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
        onLogoClick={() => setActivePage('welcome')}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        showSidebarToggle={activePage !== 'welcome'}
      />

      {/* Body */}
      <div className="flex flex-1 relative overflow-x-hidden">
        {/* Sidebar with slide-in/slide-out animation */}
        {activePage !== 'welcome' && (
          <div
            className={`transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
              isSidebarOpen ? 'w-60 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full pointer-events-none'
            }`}
          >
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
              onCollapse={() => setIsSidebarOpen(false)}
            />
          </div>
        )}

        {/* Floating Expand Button when sidebar is slid inside */}
        {activePage !== 'welcome' && !isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            title="Expand Sidebar (Ctrl+B)"
            className="fixed left-3 bottom-6 z-40 px-3 py-2 rounded-xl bg-void-card/95 border border-white/10 hover:border-pulse-coral/50 text-pulse-secondary hover:text-white shadow-2xl backdrop-blur-xl transition-all flex items-center gap-2 text-xs font-mono group hover:scale-105"
          >
            <PanelLeftOpen className="w-4 h-4 text-pulse-coral group-hover:rotate-12 transition-transform" />
            <span>Expand Menu</span>
            <kbd className="text-[10px] bg-white/5 px-1 py-0.5 rounded border border-white/10 text-pulse-tertiary">⌘B</kbd>
          </button>
        )}

        {/* Main Content Area with page transition */}
        <main
          className={`flex-1 overflow-y-auto w-full transition-all duration-300 ${
            activePage === 'welcome'
              ? 'p-0 max-w-none'
              : 'p-6 max-w-7xl mx-auto'
          }`}
        >
          <div key={activePage} className={activePage !== 'welcome' ? 'animate-page-enter' : ''}>
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(page) => setActivePage(page)}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
