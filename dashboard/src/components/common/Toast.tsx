import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ─── Variant Config ─────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
  icon: React.ElementType;
  borderColor: string;
  iconColor: string;
  progressColor: string;
  bgGlow: string;
}> = {
  success: {
    icon: CheckCircle2,
    borderColor: 'border-pulse-emerald/40',
    iconColor: 'text-pulse-emerald',
    progressColor: 'bg-pulse-emerald',
    bgGlow: 'shadow-[0_0_20px_-4px_rgba(52,211,153,0.2)]',
  },
  error: {
    icon: XCircle,
    borderColor: 'border-pulse-rose/40',
    iconColor: 'text-pulse-rose',
    progressColor: 'bg-pulse-rose',
    bgGlow: 'shadow-[0_0_20px_-4px_rgba(248,113,113,0.2)]',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-pulse-amber/40',
    iconColor: 'text-pulse-amber',
    progressColor: 'bg-pulse-amber',
    bgGlow: 'shadow-[0_0_20px_-4px_rgba(242,201,76,0.2)]',
  },
  info: {
    icon: Info,
    borderColor: 'border-pulse-sky/40',
    iconColor: 'text-pulse-sky',
    progressColor: 'bg-pulse-sky',
    bgGlow: 'shadow-[0_0_20px_-4px_rgba(110,168,254,0.2)]',
  },
};

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;

// ─── Single Toast Item ──────────────────────────────────────────────────────

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const config = VARIANT_CONFIG[toast.variant];
  const Icon = config.icon;
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const raf = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        requestAnimationFrame(raf);
      }
    };
    const handle = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(handle);
  }, [toast.duration]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration);
    return () => clearTimeout(timeout);
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-void-card/95 backdrop-blur-xl ${config.borderColor} ${config.bgGlow} transition-all duration-300 ease-out ${
        isExiting
          ? 'opacity-0 translate-x-8 scale-95'
          : 'opacity-100 translate-x-0 scale-100 animate-slide-right'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} />
        <p className="text-xs font-medium text-white leading-relaxed flex-1 pr-2">
          {toast.message}
        </p>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-0.5 rounded-md hover:bg-white/5 text-pulse-tertiary hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full bg-white/5">
        <div
          className={`h-full ${config.progressColor} transition-none`}
          style={{ width: `${progress}%`, opacity: 0.7 }}
        />
      </div>
    </div>
  );
};

// ─── Provider ───────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((variant: ToastVariant, message: string, duration = DEFAULT_DURATION) => {
    const id = `toast-${++counterRef.current}-${Date.now()}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, variant, duration, createdAt: Date.now() }];
      // Keep only the latest MAX_TOASTS
      return next.slice(-MAX_TOASTS);
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = React.useMemo<ToastContextValue>(() => ({
    success: (msg, dur) => addToast('success', msg, dur),
    error: (msg, dur) => addToast('error', msg, dur),
    warning: (msg, dur) => addToast('warning', msg, dur),
    info: (msg, dur) => addToast('info', msg, dur),
  }), [addToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 w-80 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
