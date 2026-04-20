'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { alertsService } from '@/services/alerts.service';
import type { AlertSchedule } from '@/types/api';
import type { ScheduleCalendarEvent } from './scheduling-calendar';

export interface ScheduleEventsFilter {
  startDate: string; // ISO
  endDate: string; // ISO
  account?: string;
  client?: string;
  site?: string;
  name?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | '';
}

/**
 * Build a deterministic React Query key so the cache survives view
 * changes (month→week) but invalidates when the filters actually change.
 */
function buildKey(filter: ScheduleEventsFilter) {
  return [
    'alert-schedule-events',
    filter.startDate,
    filter.endDate,
    filter.account ?? '',
    filter.client ?? '',
    filter.site ?? '',
    filter.name ?? '',
    filter.status ?? 'ACTIVE',
  ] as const;
}

/**
 * Extract the display date used by FullCalendar. The backend returns a
 * mix of shapes (`start`, `startDate`, nested `appointment.start`) so we
 * normalize here and fall back to beginDate for schedules without a
 * generated appointment yet.
 */
function pickEventStart(row: AlertSchedule): string | undefined {
  return (
    row.start ??
    row.startDate ??
    row.appointment?.start ??
    row.appointment?.startDate ??
    (row.beginDate ? `${row.beginDate}T${row.beginHour || '00:00'}:00` : undefined) ??
    undefined
  );
}

function pickEventEnd(row: AlertSchedule, startISO: string | undefined): string | undefined {
  const end =
    row.end ??
    // `endDate` on the row can be the series end (a plain YYYY-MM-DD for
    // schedules) OR the appointment end (a full ISO datetime). We only
    // want the appointment-shape one here.
    (row.endDate && row.endDate.includes('T') ? row.endDate : undefined);
  if (end) return end;
  // Fallback: derive a 1-hour block from start so the event is visible in
  // timeGrid views even when the backend didn't return an end.
  if (!startISO) return undefined;
  const d = new Date(startISO);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setMinutes(d.getMinutes() + 60);
  return d.toISOString();
}

function pickName(row: AlertSchedule): string {
  // Prefer the schedule name the user typed (e.g. "Agenda teste x").
  // The calendar filter endpoint (`appointment filterV2` with
  // `isFullCalendar: true`) projects this as `title: '$name'` — see
  // hp-shield-crud/dao/dao-appointment.js:382. Other code paths
  // (schedule shape / nested appointment) still use `name`. Check
  // every spot it can appear so we never fall through to the generic
  // "Alerta" label when a real name exists.
  const candidates: unknown[] = [
    row.name,
    (row as { title?: unknown }).title,
  ];
  const nested = (row as { schedule?: unknown }).schedule;
  if (nested && typeof nested === 'object') {
    if ('name' in nested) candidates.push((nested as { name?: unknown }).name);
    if ('title' in nested) candidates.push((nested as { title?: unknown }).title);
  }
  const appointment = (row as { appointment?: unknown }).appointment;
  if (appointment && typeof appointment === 'object') {
    if ('name' in appointment)
      candidates.push((appointment as { name?: unknown }).name);
    if ('title' in appointment)
      candidates.push((appointment as { title?: unknown }).title);
  }
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  const siteName =
    typeof row.site === 'object' && row.site && 'name' in row.site ? row.site.name : null;
  return siteName || 'Alerta';
}

function formatHHMM(startISO: string | undefined): string {
  if (!startISO) return '';
  // Plain "HH:MM" tail (no-T beginHour) — strip seconds if present.
  if (!startISO.includes('T')) {
    return startISO.length >= 5 ? startISO.slice(0, 5) : '';
  }
  const d = new Date(startISO);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Build the visible event title as `HH:MM Name` — e.g.
 * "09:15 Agenda teste x". We prepend the time ourselves (instead of
 * relying on FullCalendar's per-view displayEventTime prefix) so the
 * format is identical across month / week / day / list views and
 * matches the product spec verbatim.
 *
 * `displayEventTime={false}` in scheduling-calendar.tsx stops
 * FullCalendar from adding its own time prefix — no duplicate
 * "09:15 09:15 …" in month view.
 */
function pickTitle(row: AlertSchedule, startISO: string | undefined): string {
  const name = pickName(row);
  const hhmm = formatHHMM(startISO);
  return hhmm ? `${hhmm} ${name}` : name;
}

function pickAppointmentId(row: AlertSchedule): string | undefined {
  // The backend appointment-shape row uses the appointment's own _id as
  // the primary key. Schedule-shape rows don't have an appointment — fall
  // back to id / _id to keep React keys stable.
  return (
    (row as { appointment?: { _id?: string } }).appointment?._id ??
    row.id ??
    row._id
  );
}

function pickScheduleId(row: AlertSchedule): string | undefined {
  // Schedule id sits in different spots depending on whether the backend
  // returns a raw schedule (`_id`) or an appointment with a schedule ref
  // (`schedule._id` or `schedule` as string).
  const sRef = (row as { schedule?: unknown }).schedule;
  if (typeof sRef === 'string') return sRef;
  if (sRef && typeof sRef === 'object' && '_id' in sRef) {
    const id = (sRef as { _id?: unknown })._id;
    return typeof id === 'string' ? id : undefined;
  }
  return row._id;
}

function pickSiteName(row: AlertSchedule): string | undefined {
  if (typeof row.site === 'object' && row.site && 'name' in row.site) {
    return typeof row.site.name === 'string' ? row.site.name : undefined;
  }
  return undefined;
}

function pickEquipmentName(row: AlertSchedule): string | undefined {
  const eq = row.equipment;
  if (typeof eq === 'object' && eq && 'name' in eq) {
    const n = (eq as { name?: unknown; code?: unknown }).name;
    if (typeof n === 'string' && n) return n;
    const c = (eq as { code?: unknown }).code;
    if (typeof c === 'string' && c) return c;
  }
  return undefined;
}

/**
 * Fetches alert schedules + their generated appointments for a given
 * calendar window and maps each row into a FullCalendar event.
 *
 * Contract:
 *   - query fires only when startDate AND endDate are provided (the
 *     calendar gives us these via `datesSet`).
 *   - `staleTime: 30s` matches how often a new appointment can be
 *     generated by the backend; operators refreshing the calendar more
 *     frequently just get cached data.
 *   - returned data is the already-mapped event list so the calendar
 *     component stays dumb.
 */
export function useScheduleEvents(filter: ScheduleEventsFilter, enabled = true) {
  const query = useQuery({
    queryKey: buildKey(filter),
    queryFn: async () => {
      const res = await alertsService.filterSchedules({
        skip: 1,
        limit: 500,
        isSortByStartDate: true,
        category: 'ALERT_CHECK',
        alertOccurrence: true,
        isFullCalendar: true,
        startDate: filter.startDate,
        endDate: filter.endDate,
        ...(filter.account ? { account: filter.account } : {}),
        ...(filter.client ? { client: filter.client } : {}),
        ...(filter.site ? { site: filter.site } : {}),
        ...(filter.name ? { name: filter.name } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      });
      return res.results;
    },
    enabled: enabled && !!filter.startDate && !!filter.endDate,
    staleTime: 30 * 1000,
  });

  const events = useMemo<ScheduleCalendarEvent[]>(() => {
    const rows = query.data ?? [];
    return rows
      .map((row): ScheduleCalendarEvent | null => {
        const start = pickEventStart(row);
        if (!start) return null;
        const appointmentId = pickAppointmentId(row);
        const scheduleId = pickScheduleId(row);
        return {
          id: String(appointmentId || scheduleId || row._id),
          title: pickTitle(row, start),
          start,
          end: pickEventEnd(row, start),
          extendedProps: {
            row,
            scheduleId,
            appointmentId,
            siteName: pickSiteName(row),
            equipmentName: pickEquipmentName(row),
            frequency: row.frequency,
          },
        };
      })
      .filter((e): e is ScheduleCalendarEvent => e !== null);
  }, [query.data]);

  return {
    ...query,
    events,
  };
}
