import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary – catches unhandled React errors and shows a recovery UI.
 * Prevents the entire app from crashing due to a single component error.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHardReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-2xl">
              ⚠️
            </div>
            <h2 className="text-lg font-black text-white">
              Něco se pokazilo
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Aplikace narazila na neočekávanou chybu. Vaše data jsou v bezpečí – jsou uložena lokálně v zařízení.
            </p>
            {this.state.error && (
              <pre className="text-[10px] text-rose-400/70 bg-slate-950 rounded-lg p-3 overflow-x-auto text-left max-h-24 overflow-y-auto border border-slate-800">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 min-h-touch px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition-all"
              >
                Zkusit znovu
              </button>
              <button
                onClick={this.handleHardReset}
                className="flex-1 min-h-touch px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all"
              >
                Obnovit stránku
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
