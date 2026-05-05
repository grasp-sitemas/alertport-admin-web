'use client';

import { useEffect, useRef } from 'react';
import { getSession, touchSessionActivity } from '@/lib/session';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
];
const TOUCH_DEBOUNCE_MS = 5_000;
const POLL_INTERVAL_MS = 60_000;

interface UseInactivityTimerOptions {
  /**
   * Inactive minutes before the operator is logged out. Set to 0 (or
   * non-positive) to disable the timer entirely (e.g. via
   * `NEXT_PUBLIC_INACTIVITY_MINUTES=0`).
   */
  inactivityMinutes: number;
  /**
   * Called when the threshold is hit. Default behavior is to dispatch
   * `session:expired` so a single overlay handles inactivity AND 401
   * paths uniformly.
   */
  onExpired?: () => void;
}

/**
 * Watches operator interaction and marks the session as expired after
 * `inactivityMinutes` of silence. Intended to be mounted exactly once
 * by the auth provider for the whole authenticated shell.
 *
 * The effective trigger is `Date.now() - lastActivity > thresholdMs`,
 * polled every 60s. We do NOT use a single setTimeout because the
 * browser throttles timers in background tabs — polling on visibility
 * change avoids the "tab in background for 8h, no expiry" trap.
 */
export function useInactivityTimer({
  inactivityMinutes,
  onExpired,
}: UseInactivityTimerOptions): void {
  const lastTouchRef = useRef(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!Number.isFinite(inactivityMinutes) || inactivityMinutes <= 0) return;

    const thresholdMs = inactivityMinutes * 60_000;

    // Seed activity so a freshly-loaded tab isn't immediately expired
    // when the session was created without lastActivity.
    touchSessionActivity();
    lastTouchRef.current = Date.now();

    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouchRef.current < TOUCH_DEBOUNCE_MS) return;
      lastTouchRef.current = now;
      touchSessionActivity();
    };

    const fireExpiry = () => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      if (onExpired) {
        onExpired();
        return;
      }
      try {
        const ev = new CustomEvent('session:expired', {
          cancelable: true,
          detail: {
            reason: 'inactivity',
            proceed: () => {
              try {
                sessionStorage.removeItem('alertport_session');
              } catch {
                /* ignore */
              }
              window.location.href = '/login';
            },
          },
        });
        const intercepted = !window.dispatchEvent(ev);
        if (!intercepted) {
          try {
            sessionStorage.removeItem('alertport_session');
          } catch {
            /* ignore */
          }
          window.location.href = '/login';
        }
      } catch {
        /* ignore */
      }
    };

    const check = () => {
      const session = getSession();
      if (!session) {
        // No session = nothing to expire (login flow seeds activity
        // on mount). Reset so a re-login after expiry can re-arm.
        expiredRef.current = false;
        return;
      }
      const last = session.lastActivity ?? lastTouchRef.current;
      if (Date.now() - last > thresholdMs) {
        fireExpiry();
      }
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [inactivityMinutes, onExpired]);
}
