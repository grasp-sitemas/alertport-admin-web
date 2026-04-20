'use client';

/**
 * Last-chance error boundary (Next.js App Router).
 *
 * Catches errors that blow up even the root layout - i18n provider
 * crash, auth context throwing during hydration, etc. Replaces the
 * whole document, so it must render its own <html> + <body>. We
 * keep it minimal (no i18n, no fancy components) because the very
 * reason we're here is that one of those may be broken.
 *
 * `reset()` attempts a clean re-render of the root. If that fails
 * too, a hard reload is offered as the final escape hatch.
 */

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.error('[global-error]', error);
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          color: '#f4f4f5',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            padding: 24,
            borderRadius: 16,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.05)',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
            Algo deu errado
          </h1>
          <p style={{ fontSize: 14, color: '#a1a1aa', margin: '0 0 16px' }}>
            Encontramos um erro crítico. Tente novamente ou recarregue a página.
          </p>
          {error?.digest && (
            <p style={{ fontSize: 11, color: '#71717a', margin: '0 0 16px' }}>
              Ref: <code>{error.digest}</code>
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#a1a1aa',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
