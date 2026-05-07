'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/nextjs';
import { AuthContext, useAuthValue } from '@/hooks/use-auth';
import type { User } from '@/types/api';
import type { SessionData } from '@/lib/session';
import { subscribeSessionChanges } from '@/lib/session';
import { useInactivityTimer } from '@/hooks/use-inactivity-timer';
import { SessionExpiredOverlay } from '@/components/shared/session-expired-overlay';

const SESSION_KEY = 'alertport_session';

// Subscribe to BOTH cross-tab `storage` and same-tab
// `alertport:session-changed` events. Without the same-tab signal, an
// `updateSessionUser` / `updateSessionLanguage` in the writing tab
// would not notify subscribers (storage event only fires in OTHER
// tabs). See `src/lib/session.ts`.
function subscribe(callback: () => void): () => void {
  return subscribeSessionChanges(callback);
}

// Cache the parsed user so useSyncExternalStore gets a stable reference
// (Object.is comparison). Without this, JSON.parse creates a new object
// on every call, triggering infinite re-renders (React error #185).
let _cachedRaw: string | null = null;
let _cachedUser: User | null = null;

function getSnapshot(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw === _cachedRaw) return _cachedUser;
  _cachedRaw = raw;
  try {
    const session: SessionData | null = raw ? JSON.parse(raw) : null;
    _cachedUser = session?.user ?? null;
  } catch {
    _cachedUser = null;
  }
  return _cachedUser;
}

function getServerSnapshot(): User | null {
  return null;
}

/**
 * Resolve inactivity threshold from env. Defaults to 30 min for
 * production-safe behavior. Set `NEXT_PUBLIC_INACTIVITY_MINUTES=0`
 * to disable entirely (e.g. for kiosk-style monitor displays).
 *
 * OPERATOR exception (Flavio, 07/05): operators run a 24x7 monitoring
 * post and the auto-logout was kicking them out. They get inactivity
 * disabled regardless of the env setting. Other roles still respect
 * the env to keep admin sessions tight.
 */
function resolveInactivityMinutes(user: User | null): number {
  if (user?.companyUser?.subtype === 'OPERATOR') return 0;
  const raw = process.env.NEXT_PUBLIC_INACTIVITY_MINUTES;
  if (!raw) return 30;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 30;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const externalUser = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Local override state so login/logout flows can update synchronously
  const [overrideUser, setOverrideUser] = useState<User | null | undefined>(undefined);
  const queryClient = useQueryClient();

  const user = overrideUser === undefined ? externalUser : overrideUser;

  const setUser = (u: User | null) => setOverrideUser(u);

  // Clear the React Query cache on logout so a re-login in the same tab
  // doesn't flash stale data from the previous user (including PII
  // cached by list pages like /users, /clients, etc.).
  const onLogoutCleanup = useCallback(() => {
    // Cancel may reject if a query is mid-flight; surface the warning
    // to Sentry instead of swallowing silently. Failing to cancel is
    // recoverable (the cache is wiped right after).
    queryClient.cancelQueries().catch((err: unknown) => {
      try {
        Sentry.captureMessage('queryClient.cancelQueries failed during logout', {
          level: 'warning',
          extra: { err: err instanceof Error ? err.message : String(err) },
        });
      } catch {
        /* ignore */
      }
    });
    queryClient.clear();
  }, [queryClient]);

  const value = useAuthValue(user, setUser, onLogoutCleanup);

  // Inactivity timer fires `session:expired` after N idle minutes.
  // Mounted unconditionally — the hook short-circuits when minutes<=0
  // and when no session is present.
  useInactivityTimer({ inactivityMinutes: resolveInactivityMinutes(user) });

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredOverlay />
    </AuthContext.Provider>
  );
}
