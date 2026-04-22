'use client';

/**
 * Route-level error boundary (Next.js App Router).
 *
 * Catches any render/data-fetch exception inside a page segment and
 * renders a recoverable fallback instead of a white screen. Without
 * this, a single unhandled throw in a child component unmounts the
 * whole tree - operator has to F5 to keep working.
 *
 * `reset()` is injected by Next and retries the failing segment
 * without a full page reload (preserves React Query cache + socket).
 * For truly broken state we also expose a "recarregar página" link
 * that bypasses the boundary.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Forward the failure to Sentry. Next.js does not auto-capture
    // throws that reach a route-level error boundary - this is the
    // hook that makes them show up alongside unhandled rejections.
    // Safe no-op when Sentry was not initialized (empty DSN).
    Sentry.captureException(error);
    // Console fallback so an operator opening devtools to file a
    // ticket still sees the stack locally.
    if (typeof window !== 'undefined') {
      console.error('[route-error]', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20 text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">Algo deu errado</h2>
          <p className="text-sm text-text-secondary">
            Encontramos um erro ao renderizar esta página. Tente novamente ou
            volte ao início.
          </p>
          {error?.digest && (
            <p className="text-[11px] text-text-muted mt-2">
              Ref: <code>{error.digest}</code>
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-4 py-2 text-sm font-medium text-white transition"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 hover:bg-white/5 px-4 py-2 text-sm text-text-secondary transition"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
