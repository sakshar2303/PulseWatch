import React, { useEffect } from 'react';
import { X, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open Command Palette' },
      { keys: ['⌘', 'B'], description: 'Toggle Sidebar' },
      { keys: ['?'], description: 'Show Keyboard Shortcuts' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Esc'], description: 'Close Modal / Dismiss' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 hud-panel rounded-2xl border border-white/10 shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-pulse-coral/15 border border-pulse-coral/30 flex items-center justify-center">
              <Command className="w-3.5 h-3.5 text-pulse-coral" />
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-pulse-tertiary hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-pulse-tertiary">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-xs text-pulse-secondary">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-[10px] text-pulse-tertiary mx-0.5">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-void-elevated border border-white/10 text-[11px] font-mono text-pulse-secondary shadow-sm">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.07] flex items-center justify-between text-[10px] font-mono text-pulse-tertiary">
          <span>Press <kbd className="px-1 py-0.5 rounded bg-void-elevated border border-white/10 text-pulse-secondary">Esc</kbd> to close</span>
          <span className="text-pulse-coral">PulseWatch v1.0</span>
        </div>
      </div>
    </div>
  );
};
