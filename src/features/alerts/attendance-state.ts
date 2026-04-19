import type { PatrolAction } from '@/types/api';

/**
 * Canonical 4-state classifier for an event's attendance, shared by the
 * monitor card, the attendance dialog and the realtime toast so every
 * surface agrees on what's shown.
 *
 * The legacy shieldgo-admin-web contract (mirrored here verbatim — do not
 * invent states) is:
 *
 *   AVAILABLE              — no attendance object OR isAttendance !== true.
 *                            The event is fresh and any OPERATOR can claim it.
 *   IN_PROGRESS_BY_ME      — isAttendance === true AND status === 'IN_PROGRESS'
 *                            AND attendance.operator._id === currentUserId.
 *                            This operator claimed the event; they can add
 *                            records and close.
 *   IN_PROGRESS_BY_OTHER   — isAttendance === true AND status === 'IN_PROGRESS'
 *                            AND owned by a different user. The current
 *                            operator must NOT be allowed to re-open (that
 *                            would overwrite the other operator's claim in
 *                            the DAO's $set — see
 *                            hp-shield-crud/dao-patrolAction.js).
 *   CLOSED                 — isAttendance === true AND status === 'CLOSED'.
 *                            Historical, read-only. `isAttendance` stays
 *                            true after close — that is why naive
 *                            `isAttendance ? 'in progress' : 'available'`
 *                            logic mislabels closed events.
 */
export type AttendanceState =
  | 'AVAILABLE'
  | 'IN_PROGRESS_BY_ME'
  | 'IN_PROGRESS_BY_OTHER'
  | 'CLOSED';

export interface AttendanceOwner {
  userId?: string;
  name?: string;
}

export function extractAttendanceOwner(
  attendance: PatrolAction['attendance'] | undefined,
): AttendanceOwner {
  if (!attendance) return {};
  const raw = attendance.operator;
  if (!raw) return {};
  if (typeof raw === 'string') return { userId: raw };
  const first = (raw as { firstName?: string }).firstName ?? '';
  const last = (raw as { lastName?: string }).lastName ?? '';
  const full = `${first} ${last}`.trim();
  return {
    userId: (raw as { _id?: string })._id,
    name: full || undefined,
  };
}

export function classifyAttendance(
  event: Pick<PatrolAction, 'attendance'> | null | undefined,
  currentUserId: string | undefined,
): AttendanceState {
  const att = event?.attendance;
  if (!att || att.isAttendance !== true) return 'AVAILABLE';
  if (att.status === 'CLOSED') return 'CLOSED';
  if (att.status === 'IN_PROGRESS') {
    const ownerId = extractAttendanceOwner(att).userId;
    if (ownerId && currentUserId && ownerId === currentUserId) {
      return 'IN_PROGRESS_BY_ME';
    }
    return 'IN_PROGRESS_BY_OTHER';
  }
  // Unknown status — be conservative and treat as available so the UI
  // never locks the event over garbage data. The backend is the source of
  // truth; at worst the open-attendance call returns and we reconcile.
  return 'AVAILABLE';
}
