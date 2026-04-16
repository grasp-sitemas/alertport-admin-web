import type { User } from '@/types/api';

const SESSION_KEY = 'alertport_session';

export interface SessionData {
  token: string;
  user: User;
  correlationId?: string;
  language: string;
}

export function getSession(): SessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function setSession(data: SessionData): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSessionUser(): User | null {
  return getSession()?.user ?? null;
}

export function getSessionToken(): string | null {
  return getSession()?.token ?? null;
}

export function isSessionValid(): boolean {
  const session = getSession();
  return !!(session?.token && session?.user);
}

export function updateSessionUser(updates: Partial<User>): void {
  const session = getSession();
  if (session) {
    session.user = { ...session.user, ...updates };
    setSession(session);
  }
}

export function updateSessionLanguage(language: string): void {
  const session = getSession();
  if (session) {
    session.language = language;
    setSession(session);
  }
}
