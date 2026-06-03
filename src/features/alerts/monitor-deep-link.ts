import type { PatrolAction } from '@/types/api';
import { classifyAttendance } from './attendance-state';

/**
 * Resolve which patrol-action the SOS banner deep-link should open in the
 * AttendanceDialog, given the currently loaded monitor list.
 *
 * Rules, in order:
 *   1. If the banner correlated a concrete `patrolActionId` and that row is
 *      already loaded, open exactly that row (carries real attendance, so
 *      the dialog's another-operator lock-out works correctly).
 *   2. Otherwise, if this is an `autoClaim` link, fall back to the newest
 *      SOS still AVAILABLE for attendance. This covers two cases: the
 *      correlation missed entirely, OR the correlated row hasn't landed in
 *      the monitor list yet.
 *   3. Otherwise there's nothing actionable yet → `null`. The caller polls
 *      the list and re-runs this as fresh data arrives (the just-fired SOS
 *      is frequently not queryable the instant the Firestore push lands).
 */
export function resolveDeepLinkTarget(
  events: PatrolAction[],
  patrolActionId: string | null,
  autoClaim: boolean,
  currentUserId: string | undefined,
): PatrolAction | null {
  if (patrolActionId) {
    const byId = events.find((e) => e._id === patrolActionId);
    if (byId) return byId;
  }
  if (autoClaim) {
    return (
      events.find(
        (e) => e.type === 'SOS_ALERT' && classifyAttendance(e, currentUserId) === 'AVAILABLE',
      ) ?? null
    );
  }
  return null;
}
