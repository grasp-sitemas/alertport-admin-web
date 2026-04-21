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
 * hierarchy scope is known). The static import graph used to put
 * firebase/app + firebase/firestore on every (app) page via the shell's
 * SosNotificationProvider.
 */

import type { Unsubscribe } from 'firebase/firestore';

export type AlertportRealtimeEvent =
  | { kind: 'notification'; siteId: string; data: NotificationDoc }
  | { kind: 'media'; siteId: string; data: MediaUpdateDoc }
  | { kind: 'attendance:update'; siteGroupId: string; data: AttendanceUpdateDoc }
  | { kind: 'attendance:close'; siteGroupId: string; data: unknown }
  | { kind: 'attendance:report'; siteGroupId: string; data: unknown };

export interface NotificationDoc {
  type?: string; // 'SOS_ALERT' | 'INCIDENT' | 'CRASH' | 'LOWVOLTAGE' | 'FAILURE_PATROL' | 'CANCEL_PATROL' | 'TIME_ENTRY'
  source?: string; // 'ALERTPORT' | 'SHIELDGO'
  patrolAction?: string;
  [key: string]: unknown;
}

export interface MediaUpdateDoc {
  patrolAction?: string;
  type?: 'PHOTO' | 'SIGNATURE' | 'SOUND';
  url?: string;
}

export interface AttendanceUpdateDoc {
  attendance?: string; // JSON
  operator?: string; // JSON
  patrolActionId?: string;
}

export interface RealtimeSubscriptionOptions {
  siteIds: string[];
  siteGroupIds: string[];
  onEvent: (evt: AlertportRealtimeEvent) => void;
  /** If true, only notifications with source === 'ALERTPORT' are forwarded. Default: true. */
  onlyAlertport?: boolean;
}

/**
 * Starts Firestore listeners for the given scope. Returns a synchronous
 * unsubscribe function that is safe to call at any time - including before
 * the dynamic Firebase import resolves (in that case it simply flips an
 * internal flag so the subscription never attaches).
 */
export function subscribeToAlertportRealtime(
  options: RealtimeSubscriptionOptions,
): Unsubscribe {
  let cancelled = false;
  const unsubscribes: Unsubscribe[] = [];

  (async () => {
    const [{ doc, onSnapshot, deleteDoc }, { getDb }] = await Promise.all([
      import('firebase/firestore'),
      import('@/lib/firebase'),
    ]);
    if (cancelled) return;

    const db = getDb();
    if (!db) return;

    const { siteIds, siteGroupIds, onEvent, onlyAlertport = true } = options;

    for (const siteId of siteIds) {
      if (!siteId) continue;

      // ── notifications/{siteId} ──
      const notifRef = doc(db, 'notifications', siteId);
      unsubscribes.push(
        onSnapshot(notifRef, async (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as NotificationDoc;
          if (!data) return;
          if (onlyAlertport && data.source !== 'ALERTPORT') return;

          try {
            onEvent({ kind: 'notification', siteId, data });
          } finally {
            // Delete so it doesn't replay on next connection
            deleteDoc(notifRef).catch(() => {});
          }
        }),
      );

      // ── updatedMedias/{siteId} ──
      const mediaRef = doc(db, 'updatedMedias', siteId);
      unsubscribes.push(
        onSnapshot(mediaRef, async (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as MediaUpdateDoc;
          if (!data) return;

          try {
            onEvent({ kind: 'media', siteId, data });
          } finally {
            deleteDoc(mediaRef).catch(() => {});
          }
        }),
      );
    }

    for (const siteGroupId of siteGroupIds) {
      if (!siteGroupId) continue;

      // ── updateAttendanceEvent/{siteGroupId} ──
      const attRef = doc(db, 'updateAttendanceEvent', siteGroupId);
      unsubscribes.push(
        onSnapshot(attRef, async (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as AttendanceUpdateDoc;
          if (!data) return;
          try {
            onEvent({ kind: 'attendance:update', siteGroupId, data });
          } finally {
            deleteDoc(attRef).catch(() => {});
          }
        }),
      );

      // ── updateCloseAttendanceEvent/{siteGroupId} ──
      const closeRef = doc(db, 'updateCloseAttendanceEvent', siteGroupId);
      unsubscribes.push(
        onSnapshot(closeRef, async (snap) => {
          if (!snap.exists()) return;
          try {
            onEvent({ kind: 'attendance:close', siteGroupId, data: snap.data() });
          } finally {
            deleteDoc(closeRef).catch(() => {});
          }
        }),
      );

      // ── updateAttendanceEventReport/{siteGroupId} ──
      const reportRef = doc(db, 'updateAttendanceEventReport', siteGroupId);
      unsubscribes.push(
        onSnapshot(reportRef, async (snap) => {
          if (!snap.exists()) return;
          try {
            onEvent({ kind: 'attendance:report', siteGroupId, data: snap.data() });
          } finally {
            deleteDoc(reportRef).catch(() => {});
          }
        }),
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
