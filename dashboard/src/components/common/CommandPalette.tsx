import React, { useState, useEffect, useRef } from 'react';
import { Search, Radio, CheckCircle2, ShieldCheck, Server, AlertOctagon, Zap, ExternalLink, Activity, Network } from 'lucide-react';
import { ActivePage } from '../layout/Sidebar';

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Simulation & Chaos' | 'Diagnostics & Tools';
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: ActivePage) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: 'nav-overview',
      title: 'Go to Overview Dashboard',
      category: 'Navigation',
      icon: Activity,
      action: () => {
        onNavigate('overview');
        onClose();
      },
    },
    {
      id: 'nav-checkpoints',
      title: 'Go to Live Checkpoints & Run Feed',
      category: 'Navigation',
      icon: CheckCircle2,
      action: () => {
        onNavigate('checkpoints');
        onClose();
      },
    },
    {
      id: 'nav-topology',
      title: 'Go to Service Topology & Pipeline Map',
      category: 'Navigation',
      icon: Network,
      action: () => {
        onNavigate('topology');
        onClose();
      },
    },
    {
      id: 'nav-slo',
      title: 'Go to SLO Reliability & Error Budget',
      category: 'Navigation',
      icon: ShieldCheck,
      action: () => {
        onNavigate('slo');
        onClose();
      },
    },
    {
      id: 'nav-audit',
      title: 'Go to Silent Failure Audit Report',
      category: 'Navigation',
      icon: ShieldCheck,
      action: () => {
        onNavigate('audit');
        onClose();
      },
    },
    {
      id: 'nav-live',
      title: 'Go to Live JetStream Telemetry Stream',
      category: 'Navigation',
      icon: Radio,
      action: () => {
        onNavigate('live');
        onClose();
      },
    },
    {
      id: 'nav-fleet',
      title: 'Go to Fleet Nodes & Agents',
      category: 'Navigation',
      icon: Server,
      action: () => {
        onNavigate('fleet');
        onClose();
      },
    },
    {
      id: 'nav-anomalies',
      title: 'Go to ML Anomalies & Audits',
      category: 'Navigation',
      icon: AlertOctagon,
      action: () => {
        onNavigate('anomalies');
        onClose();
      },
    },
    {
      id: 'sim-failure',
      title: 'Simulate: Inject Silent Agent Failure (Auto-Recovery)',
      category: 'Simulation & Chaos',
      icon: Zap,
      action: () => {
        onNavigate('checkpoints');
        onClose();
      },
    },
    {
      id: 'sim-burst',
      title: 'Simulate: Spike Telemetry Load (2,000 pts/sec)',
      category: 'Simulation & Chaos',
      icon: Zap,
      action: () => {
        onNavigate('overview');
        onClose();
      },
    },
    {
      id: 'tool-jaeger',
      title: 'Open Jaeger Distributed Tracing UI (port 16686)',
      category: 'Diagnostics & Tools',
      icon: ExternalLink,
      action: () => {
        window.open('http://localhost:16686', '_blank');
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation inside modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-24 p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl bg-void-card border border-white/[0.12] shadow-2xl overflow-hidden font-sans shadow-omium-glow/5"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-void">
          <Search className="w-4 h-4 text-omium-coral shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search commands, navigate pages, run chaos simulations... (Esc to close)"
            className="w-full bg-transparent text-sm text-white placeholder-omium-tertiary outline-none font-mono"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-omium-tertiary">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-white/[0.03]">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-omium-tertiary">
              No matching commands found for "{query}".
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = selectedIndex === idx;

              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-omium-coral/15 border border-omium-coral/30 text-white'
                      : 'hover:bg-white/[0.03] text-omium-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-omium-coral' : 'text-omium-tertiary'
                      }`}
                    />
                    <span className="text-xs font-medium truncate font-sans text-white">
                      {cmd.title}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-omium-tertiary bg-white/[0.04] px-2 py-0.5 rounded shrink-0">
                    {cmd.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-void border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-omium-tertiary">
          <div className="flex items-center gap-2">
            <span>Navigate: <kbd className="text-white">↑</kbd> <kbd className="text-white">↓</kbd></span>
            <span>Select: <kbd className="text-white">↵</kbd></span>
          </div>
          <span className="text-omium-coral">PulseWatch Command Palette</span>
        </div>
      </div>
    </div>
  );
};
