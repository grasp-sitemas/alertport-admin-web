import type { User } from '@/types/api';

const SESSION_KEY = 'alertport_session';
const CHANGE_EVENT = 'alertport:session-changed';

export interface SessionData {
  token: string;
  user: User;
  correlationId?: string;
  language: string;
  /**
   * Epoch ms of the last detected operator interaction. Updated by
   * `touchSessionActivity()` (called from the inactivity-timer hook).
   * Optional so existing sessions written before this field shipped
   * keep deserializing fine.
   */
  lastActivity?: number;
}

/**
 * Same-tab change broadcast. The browser fires the native `storage`
 * event ONLY in other tabs; subscribers inside the writing tab need a
 * separate signal so `useSyncExternalStore` re-snapshots after
 * setSession / clearSession / updateSessionUser / updateSessionLanguage.
 */
function dispatchSessionChange(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to session changes from any source: cross-tab via the
 * native `storage` event, and same-tab via our custom event.
 * Returns an unsubscribe function.
 */
export function subscribeSessionChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
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
  dispatchSessionChange();
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  dispatchSessionChange();
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

/**
 * Bump `lastActivity` to "now". Designed to be called from the
 * inactivity-timer hook on user input events. Does NOT dispatch the
 * change event (would re-render the whole tree on every keystroke);
 * the timer polls its own snapshot.
 */
export function touchSessionActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as SessionData;
    session.lastActivity = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}
