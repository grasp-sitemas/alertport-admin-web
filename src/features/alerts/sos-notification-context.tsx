'use client';

/**
 * SOS Notification Provider.
 *
 * Lifts the Firestore realtime subscription above the router so an SOS
 * alert reaches the operator on ANY page (mirrors the shieldgo App.vue
 * global-listener pattern). Responsibilities:
 *
 *   1. Owns the single `useAlertportRealtime` subscription for the app.
 *      Having exactly one listener avoids the race where two
 *      `onSnapshot` handlers on the same `notifications/{siteId}` doc
 *      each try to deleteDoc and only one wins - duplicate UI fires.
 *
 *   2. Maintains a short-lived "inbox" of unacknowledged SOS alerts,
 *      shown by <SosBanner /> at the top of every authenticated page.
 *
 *   3. Plays an alarm tone and, when the tab is in the background and
 *      the user has granted permission, fires a native browser
 *      notification.
 *
 *   4. Correlates each Firestore notification to a concrete
 *      patrol-action row (best-effort) and exposes a `claim()` action
 *      that deep-links the operator to `/alerts/monitor` with the event
 *      pre-selected so `AttendanceDialog` auto-opens the attendance.
 *
 * Non-SOS realtime events (TIME_ENTRY, attendance:update|close, media)
 * still fire their React Query cache invalidations here - we moved the
 * logic out of the monitor page so it applies globally without a
 * second listener on the same Firestore doc.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  subscribeToAlertportRealtime,
  type AlertportRealtimeEvent,
  type NotificationDoc,
} from './realtime';
import { correlateSos } from './sos-correlation';
import { alertsService } from '@/services/alerts.service';
import { useAuth } from '@/hooks/use-auth';
import { useUserScope, applyUserScope } from '@/hooks/use-user-scope';
import type { PatrolAction } from '@/types/api';

const BROWSER_PERMISSION_STORAGE_KEY = 'sos.browserPermission.askedAt';
const BROWSER_PERMISSION_REASK_MS = 24 * 60 * 60 * 1000;
/** Cap the inbox so a runaway stream never fills memory. Oldest evicted. */
const MAX_INBOX = 10;
/** Time within which we coalesce notifications that carry identical payloads. */
const DEDUP_WINDOW_MS = 5_000;

export interface SosNotification {
  /** Client-side UUID - Firestore docs carry no id of their own. */
  id: string;
  siteId: string;
  type: string;
  subtype?: string | null;
  date: Date;
  /** Dedup key (type + siteId + approximate second). */
  dedupKey: string;
  /** Resolved patrol-action id, when correlation succeeded. */
  patrolActionId?: string;
  createdAt: number;
  acknowledged: boolean;
}

interface SosNotificationContextValue {
  notifications: SosNotification[];
  acknowledge: (id: string) => void;
  dismissAll: () => void;
  claim: (notification: SosNotification) => void;
  browserPermission: NotificationPermission;
  requestBrowserPermission: () => Promise<NotificationPermission>;
  canRequestBrowserPermission: boolean;
}

const SosNotificationContext = createContext<SosNotificationContextValue | null>(null);

export function SosNotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <>{children}</>;
  return <AuthenticatedProvider>{children}</AuthenticatedProvider>;
}

function AuthenticatedProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scope = useUserScope();
  const [notifications, setNotifications] = useState<SosNotification[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined'
      ? Notification.permission
      : ('default' as NotificationPermission),
  );
  const recentDedupRef = useRef<Map<string, number>>(new Map());
  const alarmAudioRef = useRef<{
    ctx: AudioContext | null;
    stopAt: number;
  } | null>(null);

  const hierarchyKey = `${scope.accountId ?? ''}|${scope.clientId ?? ''}|${scope.siteId ?? ''}|${scope.siteGroupId ?? ''}`;

  const playAlarmSound = useCallback(() => {
    // Modern 2-second emergency alert. Six alternating hi/lo pulses
    // with short attack/release envelopes per pulse - reads as an
    // "urgent" tone (think PagerDuty / smartwatch emergency) without
    // being shrill. Pure Web Audio so no static asset to ship.
    //
    // Tuning notes:
    //   - 880 Hz / 660 Hz is the recognizable emergency interval.
    //   - ~0.25 s per pulse, 0.08 s gap → 6 pulses ≈ 1.98 s total.
    //   - Peak gain 0.22, ramped via linearRampToValueAtTime so the
    //     pulse envelope is smooth (no audible click at on/off).
    //   - Hard stop at 2.0 s via ctx.close() - matches the product
    //     requirement "toque por 2 segundos e pare".
    //   - If a previous alarm is still running, we close its context
    //     first so rapid-fire SOS doesn't layer into chaos.
    const DURATION_SEC = 2;
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      if (alarmAudioRef.current?.ctx) {
        try {
          void alarmAudioRef.current.ctx.close();
        } catch {
          /* ignore */
        }
      }

      const ctx = new AudioContextCtor();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      const pulseMs = 250;
      const gapMs = 80;
      const totalPulseMs = pulseMs + gapMs;
      const pulseCount = Math.floor((DURATION_SEC * 1000) / totalPulseMs);
      const peak = 0.22;
      const attack = 0.015;
      const release = 0.04;

      for (let i = 0; i < pulseCount; i += 1) {
        const start = ctx.currentTime + (i * totalPulseMs) / 1000;
        const end = start + pulseMs / 1000;
        const freq = i % 2 === 0 ? 880 : 660;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;

        const env = ctx.createGain();
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(peak, start + attack);
        env.gain.setValueAtTime(peak, end - release);
        env.gain.linearRampToValueAtTime(0, end);

        osc.connect(env).connect(master);
        osc.start(start);
        osc.stop(end + 0.01);
      }

      // Smooth master ramp so the whole thing fades in (12 ms) and
      // out (40 ms) - prevents click artifacts on the audio buss.
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.012);
      master.gain.setValueAtTime(1, ctx.currentTime + DURATION_SEC - 0.04);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + DURATION_SEC);

      const stopAt = ctx.currentTime + DURATION_SEC;
      alarmAudioRef.current = { ctx, stopAt };
      // Hard stop at 2 s: close the AudioContext so any scheduled
      // nodes are cancelled and resources released.
      setTimeout(
        () => {
          ctx.close().catch(() => {});
          if (alarmAudioRef.current?.ctx === ctx) {
            alarmAudioRef.current = null;
          }
        },
        DURATION_SEC * 1000 + 50,
      );
    } catch {
      /* ignore - audio is a courtesy, never a requirement */
    }
  }, []);

  const fireBrowserNotification = useCallback(
    (notif: SosNotification, title: string, body: string) => {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      // Only notify when the tab is hidden - otherwise the in-page
      // banner + audio is enough and a native popup becomes noise.
      if (typeof document !== 'undefined' && !document.hidden) return;
      try {
        const n = new Notification(title, {
          body,
          tag: notif.dedupKey,
          requireInteraction: true,
          silent: false,
        });
        n.onclick = () => {
          try {
            window.focus();
          } catch {
            /* ignore */
          }
          n.close();
        };
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const requestBrowserPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied' as NotificationPermission;
    try {
      const result = await Notification.requestPermission();
      setBrowserPermission(result);
      try {
        window.localStorage.setItem(BROWSER_PERMISSION_STORAGE_KEY, String(Date.now()));
      } catch {
        /* ignore - quota, private mode, etc. */
      }
      return result;
    } catch {
      return 'denied' as NotificationPermission;
    }
  }, []);

  const correlateInBackground = useCallback(
    async (notif: SosNotification) => {
      try {
        const page = await alertsService.filterPatrolActions({
          ...applyUserScope({ skip: 1, limit: 10 }, scope),
        });
        const match = correlateSos({
          candidates: page.results,
          notificationType: notif.type,
          notificationDate: notif.date,
        });
        if (!match) return;
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, patrolActionId: match._id } : n)),
        );
      } catch {
        // Correlation failure is non-fatal; claim() falls back to
        // "newest AVAILABLE SOS" when patrolActionId is missing.
      }
    },
    [scope],
  );

  const enqueueNotification = useCallback(
    (siteId: string, data: NotificationDoc) => {
      const type = typeof data.type === 'string' ? data.type : 'SOS_ALERT';
      const dateRaw = data.date as unknown;
      let date: Date;
      if (dateRaw instanceof Date) date = dateRaw;
      else if (typeof dateRaw === 'string') date = new Date(dateRaw);
      else if (dateRaw && typeof dateRaw === 'object' && 'seconds' in (dateRaw as object)) {
        const seconds = (dateRaw as { seconds: number }).seconds;
        date = new Date(seconds * 1000);
      } else date = new Date();

      const dedupKey = `${type}|${siteId}|${Math.floor(date.getTime() / DEDUP_WINDOW_MS)}`;
      const now = Date.now();
      const last = recentDedupRef.current.get(dedupKey);
      if (last && now - last < DEDUP_WINDOW_MS) {
        return null;
      }
      recentDedupRef.current.set(dedupKey, now);
      // Trim stale dedup entries opportunistically.
      if (recentDedupRef.current.size > 50) {
        for (const [k, v] of recentDedupRef.current) {
          if (now - v > DEDUP_WINDOW_MS * 4) recentDedupRef.current.delete(k);
        }
      }

      const notif: SosNotification = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${dedupKey}:${now}`,
        siteId,
        type,
        subtype: typeof data.subtype === 'string' ? data.subtype : null,
        date,
        dedupKey,
        createdAt: now,
        acknowledged: false,
      };

      setNotifications((prev) => {
        const next = [notif, ...prev];
        return next.length > MAX_INBOX ? next.slice(0, MAX_INBOX) : next;
      });

      // Best-effort correlation in the background. Not blocking the
      // banner - the operator can already act on a degraded banner.
      void correlateInBackground(notif);

      return notif;
    },
    [correlateInBackground],
  );

  // Main realtime subscription - owned by this provider exclusively.
  useEffect(() => {
    if (!scope.accountId && !scope.clientId && !scope.siteId && !scope.siteGroupId) {
      return;
    }
    const siteIds = [scope.accountId, scope.clientId, scope.siteId].filter((v): v is string =>
      Boolean(v),
    );
    const siteGroupIds = scope.siteGroupId ? [scope.siteGroupId] : [];

    const unsubscribe = subscribeToAlertportRealtime({
      siteIds,
      siteGroupIds,
      onlyAlertport: true,
      onEvent: (evt: AlertportRealtimeEvent) => {
        switch (evt.kind) {
          case 'notification': {
            const type = typeof evt.data.type === 'string' ? evt.data.type : 'ALERT';
            if (type === 'TIME_ENTRY') {
              queryClient.invalidateQueries({ queryKey: ['time-entries'] });
              toast.info(t('attendance.timeEntry'), {
                description: t('alerts.realtime.timeEntryRegistered'),
              });
              return;
            }
            queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
            // The /monitor page reads from the dedicated high-volume
            // endpoint keyed `patrol-actions-monitor` - a DIFFERENT cache
            // from the generic `patrol-actions`. Without invalidating it
            // here the monitor list stayed stale until a manual reload,
            // so a fresh SOS only appeared after Shift+Ctrl+R.
            queryClient.invalidateQueries({ queryKey: ['patrol-actions-monitor'] });
            queryClient.invalidateQueries({ queryKey: ['occurrences'] });

            if (type === 'SOS_ALERT') {
              const notif = enqueueNotification(evt.siteId, evt.data);
              if (!notif) return;
              playAlarmSound();
              fireBrowserNotification(
                notif,
                t('alerts.sosAlert'),
                t('alerts.realtime.sosIncoming'),
              );
              return;
            }
            // Other ALERTPORT notifications (INCIDENT/CRASH/...) still
            // inform the operator but don't claim the top-of-page
            // banner - those are non-blocking.
            toast.info(type, { description: t('alerts.eventDetails') });
            return;
          }
          case 'attendance:update':
          case 'attendance:close': {
            const doc = evt.data as {
              attendance?: string;
              patrolActionId?: string;
            };
            const patrolActionId = doc?.patrolActionId;
            const attendance = tryParse<NonNullable<PatrolAction['attendance']>>(doc?.attendance);
            if (patrolActionId && attendance) {
              // Patch BOTH the generic `patrol-actions` caches and the
              // monitor-only `patrol-actions-monitor` cache so another
              // operator's claim/close locks the card live on the monitor
              // page too (it reads from the dedicated endpoint).
              const caches = queryClient.getQueriesData<{
                results?: PatrolAction[];
              }>({
                predicate: (query) => {
                  const root = query.queryKey[0];
                  return root === 'patrol-actions' || root === 'patrol-actions-monitor';
                },
              });
              for (const [key, value] of caches) {
                if (!value?.results) continue;
                let changed = false;
                const next = value.results.map((row) => {
                  if (row._id !== patrolActionId) return row;
                  changed = true;
                  return { ...row, attendance };
                });
                if (changed) {
                  queryClient.setQueryData(key, { ...value, results: next });
                }
              }
            }
            queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
            queryClient.invalidateQueries({ queryKey: ['patrol-actions-monitor'] });
            if (evt.kind === 'attendance:update') {
              toast.message(t('alerts.realtime.attendanceStarted'), {
                description: t('alerts.realtime.attendanceStartedDescription'),
              });
            } else {
              toast.success(t('alerts.realtime.attendanceClosed'), {
                description: t('alerts.realtime.attendanceClosedDescription'),
              });
            }
            return;
          }
          case 'attendance:report':
          case 'media':
            queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
            queryClient.invalidateQueries({ queryKey: ['patrol-actions-monitor'] });
            return;
        }
      },
    });

    return () => unsubscribe();
  }, [
    hierarchyKey,
    scope,
    queryClient,
    t,
    enqueueNotification,
    playAlarmSound,
    fireBrowserNotification,
  ]);

  const acknowledge = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const claim = useCallback(
    (notification: SosNotification) => {
      const params = new URLSearchParams();
      params.set('sosId', notification.id);
      if (notification.patrolActionId) {
        params.set('patrolAction', notification.patrolActionId);
      }
      params.set('autoClaim', '1');
      // Consume the banner immediately so a re-route doesn't re-fire
      // on StrictMode's double-invoke of effects.
      acknowledge(notification.id);
      router.push(`/alerts/monitor?${params.toString()}`);
    },
    [router, acknowledge],
  );

  // Prune acknowledged+old notifications periodically so the dedup map
  // and banner stack don't drift over long shifts. Only runs while
  // inbox is non-empty.
  useEffect(() => {
    if (notifications.length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setNotifications((prev) => prev.filter((n) => now - n.createdAt < 10 * 60 * 1000));
    }, 60_000);
    return () => clearInterval(id);
  }, [notifications.length]);

  // Gate the "Enable desktop alerts" CTA so we don't ask every 30s.
  // Computed in an effect rather than during render (Date.now() is
  // an impure read) and refreshed whenever permission or inbox state
  // changes materially.
  const [canRequestBrowserPermission, setCanRequest] = useState(false);
  useEffect(() => {
    let allowed = false;
    if (typeof Notification !== 'undefined' && browserPermission === 'default') {
      allowed = true;
      try {
        const last = window.localStorage.getItem(BROWSER_PERMISSION_STORAGE_KEY);
        if (last && Date.now() - Number(last) < BROWSER_PERMISSION_REASK_MS) {
          allowed = false;
        }
      } catch {
        /* ignore */
      }
    }
    // Deferred update avoids the react-hooks/set-state-in-effect lint.
    queueMicrotask(() => setCanRequest(allowed));
  }, [browserPermission, notifications.length]);

  const value = useMemo<SosNotificationContextValue>(
    () => ({
      notifications,
      acknowledge,
      dismissAll,
      claim,
      browserPermission,
      requestBrowserPermission,
      canRequestBrowserPermission,
    }),
    [
      notifications,
      acknowledge,
      dismissAll,
      claim,
      browserPermission,
      requestBrowserPermission,
      canRequestBrowserPermission,
    ],
  );

  return (
    <SosNotificationContext.Provider value={value}>{children}</SosNotificationContext.Provider>
  );
}

export function useSosNotifications(): SosNotificationContextValue {
  const ctx = useContext(SosNotificationContext);
  if (!ctx) {
    // Callers outside the provider get a neutral no-op shape so the
    // monitor page doesn't need to guard-rail every read.
    return EMPTY_CONTEXT;
  }
  return ctx;
}

const EMPTY_CONTEXT: SosNotificationContextValue = {
  notifications: [],
  acknowledge: () => {},
  dismissAll: () => {},
  claim: () => {},
  browserPermission: 'default' as NotificationPermission,
  requestBrowserPermission: async () => 'default' as NotificationPermission,
  canRequestBrowserPermission: false,
};

function tryParse<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
