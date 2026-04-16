'use client';

import { useState, useSyncExternalStore } from 'react';
import { AuthContext, useAuthValue } from '@/hooks/use-auth';
import { getSessionUser } from '@/lib/session';
import type { User } from '@/types/api';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): User | null {
  return getSessionUser();
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
