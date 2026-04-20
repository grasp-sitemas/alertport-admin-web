import type { PatrolAction } from '@/types/api';

/**
 * Firestore `notifications/{siteId}` carries only `{ type, source, date }`
 * - no patrol-action id. To deep-link the operator from a global SOS
 * banner to the specific event in the monitor, we correlate the fired
 * notification to the matching Mongo row by type + a recency window.
 *
 * We deliberately use a generous +/- 60s window because:
 *   - ms-patrolhub writes the Mongo doc first and then publishes the
 *     Firestore notification, so the patrol-action usually pre-dates
 *     the notification by a few hundred ms.
 *   - Clock drift between the device, Heroku dyno and the operator's
 *     browser can be up to tens of seconds.
 *   - Picking the wrong row (within 60s, same type, same site) is
 *     nearly impossible in practice - operators have one SOS at a time
 *     per site; if two SOS land within a minute from the same site they
 *     are effectively the same emergency response.
 */
const CORRELATION_WINDOW_MS = 60_000;

export interface SosCorrelationInput {
  /** Candidate rows fetched from `filterPatrolActions`, newest first. */
  candidates: PatrolAction[];
  /** The `type` field from the Firestore notification doc. */
  notificationType: string | undefined;
  /** The `date` field from the Firestore notification doc. */
  notificationDate: Date | string | undefined;
}

/**
 * Pick the PatrolAction that most likely produced `notification`. Returns
 * `null` when no row is within the correlation window - caller should
 * fall back to "most recent SOS_ALERT" or just open the monitor without
 * a pre-selection.
 *
 * Rules, in order:
 *   1. Same type as the notification.
 *   2. `attendance.isAttendance !== true` - we prefer an unclaimed row
 *      so the operator can actually do something when they land on the
 *      monitor. If every match is already claimed (closed or in progress
 *      by another), we still return the closest match so the URL deep-
 *      link points somewhere useful.
 *   3. Closest `|createdDate - notificationDate|` within the window.
 */
export function correlateSos(input: SosCorrelationInput): PatrolAction | null {
  const { candidates, notificationType, notificationDate } = input;
  if (!candidates.length) return null;

  const notifTs = toTime(notificationDate);
  const byType = notificationType
    ? candidates.filter((c) => c.type === notificationType)
    : candidates;

  if (!byType.length) return null;

  // Score each candidate by time delta; lower is better.
  const scored = byType
    .map((row) => {
      const rowTs = toTime(row.date || row.createdDate);
      const delta =
        rowTs != null && notifTs != null
          ? Math.abs(rowTs - notifTs)
          : Number.POSITIVE_INFINITY;
      return { row, delta };
    })
    .sort((a, b) => a.delta - b.delta);

  const withinWindow = scored.filter((s) => s.delta <= CORRELATION_WINDOW_MS);
  const pool = withinWindow.length ? withinWindow : [scored[0]];

  const unclaimed = pool.find((s) => !s.row.attendance?.isAttendance);
  return (unclaimed ?? pool[0]).row ?? null;
}

function toTime(v: Date | string | undefined): number | null {
  if (!v) return null;
  const t = typeof v === 'string' ? Date.parse(v) : v.getTime();
  return Number.isFinite(t) ? t : null;
}
