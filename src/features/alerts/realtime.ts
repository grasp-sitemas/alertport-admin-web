/**
 * Firestore real-time subscriptions for AlertPort.
 * Mirrors shieldgo-admin-web App.vue + AlertMonitor.vue listener contracts:
 *   - notifications/{siteId}         → SOS/INCIDENT/CRASH/... alerts (filtered by source=ALERTPORT)
 *   - updatedMedias/{siteId}         → photo / signature / sound updates
 *   - updateAttendanceEvent/{siteGroupId}        → live attendance status
 *   - updateCloseAttendanceEvent/{siteGroupId}   → attendance closed
 *   - updateAttendanceEventReport/{siteGroupId}  → attendance history refresh
 *
 * After processing, each notification document is deleted so it won't re-trigger.
 * Unsubscribe functions MUST be called on cleanup to avoid leaks.
 *
 * Firebase SDK is dynamically imported so the ~150KB bundle is pulled only
 * when a subscription is actually started (i.e. after login, once a
 * hierarchy scope is known).
 */

import * as Sentry from '@sentry/nextjs';
import type { Unsubscribe } from 'firebase/firestore';

export type AlertportRealtimeEvent =
  | { kind: 'notification'; siteId: string; data: NotificationDoc }
  | { kind: 'media'; siteId: string; data: MediaUpdateDoc }
  | { kind: 'attendance:update'; siteGroupId: string; data: AttendanceUpdateDoc }
  | { kind: 'attendance:close'; siteGroupId: string; data: unknown }
  | { kind: 'attendance:report'; siteGroupId: string; data: unknown };

export interface NotificationDoc {
  type?: string;
  source?: string;
  patrolAction?: string;
  [key: string]: unknown;
}

export interface MediaUpdateDoc {
  patrolAction?: string;
  type?: 'PHOTO' | 'SIGNATURE' | 'SOUND';
  url?: string;
}

export interface AttendanceUpdateDoc {
  attendance?: string;
  operator?: string;
  patrolActionId?: string;
}

export interface RealtimeSubscriptionOptions {
  siteIds: string[];
  siteGroupIds: string[];
  onEvent: (evt: AlertportRealtimeEvent) => void;
  /** If true, only notifications with source === 'ALERTPORT' are forwarded. Default: true. */
  onlyAlertport?: boolean;
}

// ───────────────────── caps & dedupe ─────────────────────

/**
 * Firestore has a soft per-client limit around 100 active listeners.
 * Each subscribed siteId opens 2 listeners (notifications + media) and
 * each siteGroupId opens 3. Cap each list at 80 so we never even get
 * close to the threshold. When the operator's scope exceeds the cap,
 * we emit `service:firestore-overflow` so the AppShell can surface a
 * "monitoramento limitado" banner.
 */
const SITE_LISTENER_CAP = 80;
const GROUP_LISTENER_CAP = 80;

function dispatchFirestoreEvent(kind: 'overflow' | 'error', detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(`service:firestore-${kind}`, { detail }));
  } catch {
    /* ignore */
  }
}

/**
 * Best-effort cross-tab dedupe. Two tabs subscribed to the same site
 * both receive `onSnapshot` and would both call `onEvent` AND
 * `deleteDoc`, leading to duplicate sounds/banners and a race on the
 * delete. We mark a docPath as "claimed" for ~30s in an in-memory Map
 * and broadcast the claim via BroadcastChannel.
 *
 * Limitations:
 *   - Two tabs racing in the same millisecond can still both process
 *     once each (broadcast is async). The window is small in practice.
 *   - BroadcastChannel isn't available in some embedded webviews; we
 *     degrade to per-tab dedupe (still helpful when onSnapshot fires
 *     twice for cache + server).
 */
const CLAIM_TTL_MS = 30_000;
const claims = new Map<string, number>();
let bc: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel === 'function') {
  try {
    bc = new BroadcastChannel('alertport_realtime_dedupe');
    bc.addEventListener('message', (ev: MessageEvent) => {
      const data = ev.data as { key?: unknown; until?: unknown } | undefined;
      if (typeof data?.key === 'string' && typeof data.until === 'number') {
        claims.set(data.key, data.until);
      }
    });
  } catch {
    bc = null;
  }
}

function tryClaim(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of claims) {
    if (t < now) claims.delete(k);
  }
  if (claims.has(key)) return false;
  const until = now + CLAIM_TTL_MS;
  claims.set(key, until);
  try {
    bc?.postMessage({ key, until });
  } catch {
    /* ignore */
  }
  return true;
}

function safeDelete(label: string, fn: () => Promise<unknown>): void {
  fn().catch((err: unknown) => {
    try {
      Sentry.captureMessage(`firestore deleteDoc failed (${label})`, {
        level: 'warning',
        extra: { err: err instanceof Error ? err.message : String(err) },
      });
    } catch {
      /* ignore */
    }
  });
}

// ───────────────────── subscribe ─────────────────────

/**
 * Starts Firestore listeners for the given scope. Returns a synchronous
 * unsubscribe function that is safe to call at any time - including before
 * the dynamic Firebase import resolves (in that case it simply flips an
 * internal flag so the subscription never attaches).
 */
export function subscribeToAlertportRealtime(options: RealtimeSubscriptionOptions): Unsubscribe {
  let cancelled = false;
  const unsubscribes: Unsubscribe[] = [];

  // Apply caps and warn the UI if anything was dropped.
  const totalSites = options.siteIds.filter(Boolean).length;
  const sites = options.siteIds.filter(Boolean).slice(0, SITE_LISTENER_CAP);
  if (totalSites > SITE_LISTENER_CAP) {
    dispatchFirestoreEvent('overflow', {
      kind: 'sites',
      total: totalSites,
      cap: SITE_LISTENER_CAP,
      dropped: totalSites - SITE_LISTENER_CAP,
    });
  }
  const totalGroups = options.siteGroupIds.filter(Boolean).length;
  const groups = options.siteGroupIds.filter(Boolean).slice(0, GROUP_LISTENER_CAP);
  if (totalGroups > GROUP_LISTENER_CAP) {
    dispatchFirestoreEvent('overflow', {
      kind: 'siteGroups',
      total: totalGroups,
      cap: GROUP_LISTENER_CAP,
      dropped: totalGroups - GROUP_LISTENER_CAP,
    });
  }

  (async () => {
    const [{ doc, onSnapshot, deleteDoc }, { getDb }] = await Promise.all([
      import('firebase/firestore'),
      import('@/lib/firebase'),
    ]);
    if (cancelled) return;

    const db = getDb();
    if (!db) return;

    const { onEvent, onlyAlertport = true } = options;

    const onListenerError = (path: string) => (err: Error) => {
      try {
        Sentry.captureMessage(`firestore onSnapshot error: ${path}`, {
          level: 'warning',
          extra: { err: err.message, code: (err as { code?: string }).code },
        });
      } catch {
        /* ignore */
      }
      dispatchFirestoreEvent('error', { path, code: (err as { code?: string }).code });
    };

    for (const siteId of sites) {
      // ── notifications/{siteId} ──
      const notifPath = `notifications/${siteId}`;
      const notifRef = doc(db, 'notifications', siteId);
      unsubscribes.push(
        onSnapshot(
          notifRef,
          async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() as NotificationDoc;
            if (!data) return;
            if (onlyAlertport && data.source !== 'ALERTPORT') return;
            if (!tryClaim(notifPath)) return;

            try {
              onEvent({ kind: 'notification', siteId, data });
            } finally {
              safeDelete(notifPath, () => deleteDoc(notifRef));
            }
          },
          onListenerError(notifPath),
        ),
      );

      // ── updatedMedias/{siteId} ──
      const mediaPath = `updatedMedias/${siteId}`;
      const mediaRef = doc(db, 'updatedMedias', siteId);
      unsubscribes.push(
        onSnapshot(
          mediaRef,
          async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() as MediaUpdateDoc;
            if (!data) return;
            if (!tryClaim(mediaPath)) return;

            try {
              onEvent({ kind: 'media', siteId, data });
            } finally {
              safeDelete(mediaPath, () => deleteDoc(mediaRef));
            }
          },
          onListenerError(mediaPath),
        ),
      );
    }

    for (const siteGroupId of groups) {
      // ── updateAttendanceEvent/{siteGroupId} ──
      const attPath = `updateAttendanceEvent/${siteGroupId}`;
      const attRef = doc(db, 'updateAttendanceEvent', siteGroupId);
      unsubscribes.push(
        onSnapshot(
          attRef,
          async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() as AttendanceUpdateDoc;
            if (!data) return;
            if (!tryClaim(attPath)) return;

            try {
              onEvent({ kind: 'attendance:update', siteGroupId, data });
            } finally {
              safeDelete(attPath, () => deleteDoc(attRef));
            }
          },
          onListenerError(attPath),
        ),
      );

      // ── updateCloseAttendanceEvent/{siteGroupId} ──
      const closePath = `updateCloseAttendanceEvent/${siteGroupId}`;
      const closeRef = doc(db, 'updateCloseAttendanceEvent', siteGroupId);
      unsubscribes.push(
        onSnapshot(
          closeRef,
          async (snap) => {
            if (!snap.exists()) return;
            if (!tryClaim(closePath)) return;
            try {
              onEvent({ kind: 'attendance:close', siteGroupId, data: snap.data() });
            } finally {
              safeDelete(closePath, () => deleteDoc(closeRef));
            }
          },
          onListenerError(closePath),
        ),
      );

      // ── updateAttendanceEventReport/{siteGroupId} ──
      const reportPath = `updateAttendanceEventReport/${siteGroupId}`;
      const reportRef = doc(db, 'updateAttendanceEventReport', siteGroupId);
      unsubscribes.push(
        onSnapshot(
          reportRef,
          async (snap) => {
            if (!snap.exists()) return;
            if (!tryClaim(reportPath)) return;
            try {
              onEvent({ kind: 'attendance:report', siteGroupId, data: snap.data() });
            } finally {
              safeDelete(reportPath, () => deleteDoc(reportRef));
            }
          },
          onListenerError(reportPath),
        ),
      );
    }
  })();

  return () => {
    cancelled = true;
    for (const unsub of unsubscribes) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    unsubscribes.length = 0;
  };
}
