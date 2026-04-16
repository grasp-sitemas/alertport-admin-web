'use client';

import { useState, useSyncExternalStore } from 'react';
import { AuthContext, useAuthValue } from '@/hooks/use-auth';
import type { User } from '@/types/api';
import type { SessionData } from '@/lib/session';

const SESSION_KEY = 'alertport_session';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const externalUser = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Local override state so login/logout flows can update synchronously
  const [overrideUser, setOverrideUser] = useState<User | null | undefined>(undefined);

  const user = overrideUser === undefined ? externalUser : overrideUser;

  const setUser = (u: User | null) => setOverrideUser(u);

  const value = useAuthValue(user, setUser);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
