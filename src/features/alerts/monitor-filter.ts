import type { EventType, PatrolAction } from '@/types/api';
import { formatDeviceLabel } from './device-label';
import { classifyAttendance, extractAttendanceOwner, type AttendanceState } from './attendance-state';

export const MONITOR_EVENT_TYPES: EventType[] = [
  'SOS_ALERT',
  'INCIDENT',
  'CRASH',
  'LOWVOLTAGE',
  'CANCEL_PATROL',
  'FAILURE_PATROL',
];

export const MONITOR_STATUS_VALUES: AttendanceState[] = [
  'AVAILABLE',
  'IN_PROGRESS_BY_ME',
  'IN_PROGRESS_BY_OTHER',
  'CLOSED',
];

export interface MonitorClientFilters {
  /** Free-text search, case-insensitive. Empty string matches everything. */
  q: string;
  /** Single event type or empty string for all. */
  type: EventType | '';
  /** Attendance state or empty string for all. */
  status: AttendanceState | '';
}

function asName(obj: unknown): string {
  if (!obj) return '';
  if (typeof obj === 'string') return '';
  if (typeof obj !== 'object') return '';
  const anyObj = obj as { name?: unknown };
  return typeof anyObj.name === 'string' ? anyObj.name : '';
}

function buildHaystack(event: PatrolAction, typeLabel: string | undefined): string {
  const owner = extractAttendanceOwner(event.attendance);
  const parts = [
    formatDeviceLabel(event),
    event.notes,
    owner.name,
    typeLabel,
    asName(event.equipment),
    asName(event.site),
    asName(event.client),
    asName(event.account),
    typeof event.equipment === 'object' ? (event.equipment as { serial?: string })?.serial : '',
    typeof event.equipment === 'object' ? (event.equipment as { imei?: string })?.imei : '',
    event.deviceInfo?.deviceId,
    event.deviceInfo?.name,
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Apply client-side Monitor filters to the list of events that came back
 * from the server. Server-side filters (hierarchy, date range) already
 * trimmed the result; this narrows further on type / attendance state /
 * free-text - all purely visual so toggling a filter never re-issues the
 * query.
 */
export function filterMonitorEvents(
  events: PatrolAction[],
  filters: MonitorClientFilters,
  currentUserId: string | undefined,
  typeLabelFor: (type: EventType) => string | undefined,
): PatrolAction[] {
  const q = filters.q.trim().toLowerCase();
  if (!filters.type && !filters.status && !q) return events;

  const out: PatrolAction[] = [];
  for (const event of events) {
    if (filters.type && event.type !== filters.type) continue;
    if (filters.status) {
      const state = classifyAttendance(event, currentUserId);
      if (state !== filters.status) continue;
    }
    if (q) {
      const haystack = buildHaystack(event, typeLabelFor(event.type));
      if (!haystack.includes(q)) continue;
    }
    out.push(event);
  }
  return out;
}
