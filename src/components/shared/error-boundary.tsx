'use client';

import { Component, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback render. Default = compact recoverable card. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Tag for Sentry scope. Defaults to 'feature'. */
  tag?: string;
}

interface ErrorBoundaryState {
  error?: Error;
}

/**
 * Per-feature error boundary. Use to wrap a high-risk feature subtree
 * (e.g. the realtime alert monitor, the SOS context) so a crash in
 * that subtree doesn't propagate up to `app/error.tsx` and unmount
 * the whole route.
 *
 * Forwarded to Sentry with a `feature` tag so the dashboard can split
 * these out from generic route errors.
 *
 * Note: this is the LAST place to use a class component in this app —
 * React still requires class boundaries for `componentDidCatch` /
 * `getDerivedStateFromError`. There is no hooks equivalent yet.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    try {
      Sentry.withScope((scope) => {
        scope.setTag('feature', this.props.tag || 'feature');
        scope.setExtra('componentStack', info.componentStack);
        Sentry.captureException(error);
      });
    } catch {
      /* never let logging itself unmount the boundary */
    }
  }

  reset = (): void => {
    this.setState({ error: undefined });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="m-4 space-y-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">Esta área parou de funcionar.</p>
          <p className="text-text-secondary text-xs">
            Tente recarregar a seção. O restante do painel continua disponível.
          </p>
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="bg-brand-600 hover:bg-brand-500 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    );
  }
}
