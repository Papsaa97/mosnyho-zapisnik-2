/**
 * Global Toast Notification System
 * Lightweight, zero-dependency toast implementation using React context.
 */
import React, { useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Trash2, FileCheck2, X } from 'lucide-react';
import { ToastContext, Toast, ToastVariant } from './toastContext';

const ICON_MAP: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error:   Trash2,
  warning: AlertTriangle,
  info:    FileCheck2
};

const STYLE_MAP: Record<ToastVariant, string> = {
  success: 'bg-slate-900 border-emerald-500/50 text-emerald-300',
  error:   'bg-slate-900 border-rose-500/50 text-rose-300',
  warning: 'bg-slate-900 border-amber-500/50 text-amber-300',
  info:    'bg-slate-900 border-sky-500/50 text-sky-300'
};

const ICON_STYLE_MAP: Record<ToastVariant, string> = {
  success: 'text-emerald-400',
  error:   'text-rose-400',
  warning: 'text-amber-400',
  info:    'text-sky-400'
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timerRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => {
      // Cap at 3 concurrent toasts
      const next = [...prev, { id, message, variant }];
      return next.slice(-3);
    });

    const timer = setTimeout(() => removeToast(id), 3500);
    timerRefs.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container: fixed, bottom-center, above mobile nav */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none"
      >
        {toasts.map(toast => {
          const Icon = ICON_MAP[toast.variant];
          return (
            <div
              key={toast.id}
              role="alert"
              className={[
                'pointer-events-auto',
                'flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border',
                'text-xs sm:text-sm font-semibold min-w-[200px] max-w-[320px]',
                'animate-in fade-in slide-in-from-bottom-2 duration-200',
                STYLE_MAP[toast.variant]
              ].join(' ')}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${ICON_STYLE_MAP[toast.variant]}`} />
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-1 text-slate-500 hover:text-slate-200 transition-colors"
                aria-label="Zavřít notifikaci"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
