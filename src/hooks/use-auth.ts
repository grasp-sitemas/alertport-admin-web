'use client';

import { createContext, useContext, useCallback, useMemo } from 'react';
import type { User, UserSubtype } from '@/types/api';
import {
  getSession,
  setSession,
  clearSession,
  isSessionValid,
  type SessionData,
} from '@/lib/session';
import { isAllowedAdminUser, isSuperAdminMaster, isMasterEmailAllowed } from '@/config/roles';
import { disconnectSocket } from '@/lib/socket';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (session: SessionData) => void;
  logout: () => void;
  userSubtype: UserSubtype | undefined;
  hasRole: (roles: UserSubtype[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthValue(
  user: User | null,
  setUser: (user: User | null) => void,
  /**
   * Extra cleanup the provider wants to run on logout — wired by
   * AuthProvider to clear React Query cache (avoid stale data flashing
   * from a previous session if the user re-logs in the same tab).
   */
  onLogoutCleanup?: () => void,
): AuthContextValue {
  const session = typeof window !== 'undefined' ? getSession() : null;

  const login = useCallback(
    (sessionData: SessionData) => {
      setSession(sessionData);
      setUser(sessionData.user);
    },
    [setUser],
  );

  const logout = useCallback(() => {
    // Order matters: disconnect network listeners FIRST so any in-flight
    // events don't try to touch React state after the provider resets.
    // Socket + Firestore subs + query cache — everything network-side.
    try {
      disconnectSocket();
    } catch {
      /* best-effort; a broken socket shouldn't block logout */
    }
    try {
      onLogoutCleanup?.();
    } catch {
      /* ignore */
    }
    clearSession();
    setUser(null);
    if (typeof window !== 'undefined') {
      // Broadcast so any other tab (same origin) re-reads sessionStorage
      // via the `storage` event subscription in AuthProvider. Also useful
      // for future listeners (analytics, toast, etc.).
      try {
        window.dispatchEvent(new CustomEvent('auth:logout'));
      } catch {
        /* ignore */
      }
      window.location.href = '/login';
    }
  }, [setUser, onLogoutCleanup]);

  const userSubtype = user?.companyUser?.subtype;

  const hasRole = useCallback(
    (roles: UserSubtype[]) => {
      if (!userSubtype) return false;
      return roles.includes(userSubtype);
    },
    [userSubtype],
  );

  return useMemo(
    () => ({
      user,
      token: session?.token ?? null,
      isAuthenticated: !!user && isSessionValid(),
      login,
      logout,
      userSubtype,
      hasRole,
    }),
    [user, session?.token, login, logout, userSubtype, hasRole],
  );
}

export function validateLoginUser(user: User): { valid: boolean; errorKey?: string } {
  if (user.status === 'ARCHIVED') {
    return { valid: false, errorKey: 'auth.loginArchivedUser' };
  }

  if (!isAllowedAdminUser(user.companyUser?.subtype)) {
    return { valid: false, errorKey: 'auth.loginUnauthorized' };
  }

  if (isSuperAdminMaster(user.companyUser?.subtype) && !isMasterEmailAllowed(user.email)) {
    return { valid: false, errorKey: 'auth.loginUnauthorized' };
  }

  return { valid: true };
}
