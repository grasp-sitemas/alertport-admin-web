'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogIn, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExpiredDetail {
  reason?: 'inactivity' | 'unauthorized' | string;
  proceed?: () => void;
}

/**
 * Listens for `session:expired` events dispatched by:
 *   - src/lib/api-client.ts (on 401 from any backend call)
 *   - src/hooks/use-inactivity-timer.ts (after N idle minutes)
 *
 * Both dispatchers send a cancelable CustomEvent with
 * `detail.proceed` — the original "clear session + redirect"
 * callback. This overlay calls `preventDefault()` so the dispatcher
 * does NOT destroy the session immediately; instead we render a
 * blocking modal that lets the operator finish what's in front of
 * them (a SOS call, a partially-filled attendance form, an in-flight
 * save) before voluntarily reauthenticating.
 *
 * Safety net: the operator can always click the primary action to
 * proceed with the original redirect. If this overlay isn't mounted,
 * the dispatcher's behavior is the legacy hard-redirect.
 */
export function SessionExpiredOverlay() {
  const t = useTranslations();
  const [pending, setPending] = useState<ExpiredDetail | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onExpired = (e: Event) => {
      const ce = e as CustomEvent<ExpiredDetail>;
      // Cancel the dispatcher's default redirect so we can show UI.
      if (typeof ce.preventDefault === 'function') ce.preventDefault();
      const detail = ce.detail || {};
      // First-wins: a burst of 401s during an outage shouldn't stack
      // multiple modals on top of each other.
      setPending((prev) => prev ?? detail);
    };
    window.addEventListener('session:expired', onExpired as EventListener);
    return () => window.removeEventListener('session:expired', onExpired as EventListener);
  }, []);

  if (!pending) return null;

  const reasonKey =
    pending.reason === 'inactivity'
      ? 'auth.sessionExpiredInactivity'
      : 'auth.sessionExpiredUnauthorized';

  const reconnect = () => {
    const proceed = pending.proceed;
    setPending(null);
    if (typeof proceed === 'function') {
      proceed();
      return;
    }
    try {
      sessionStorage.removeItem('alertport_session');
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') window.location.href = '/login';
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-500/30 bg-[#0a0e1a] p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <Lock className="h-5 w-5" />
          </div>
          <h2 id="session-expired-title" className="text-lg font-semibold text-white">
            {t('auth.sessionExpiredTitle')}
          </h2>
        </div>
        <p className="text-text-secondary text-sm">{t(reasonKey)}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button onClick={reconnect}>
            <LogIn className="h-4 w-4" />
            {t('auth.sessionExpiredReconnect')}
          </Button>
        </div>
      </div>
    </div>
  );
}
