/**
 * Contract tests for the attendance mutation API.
 *
 * openAttendance / closeAttendance are the two endpoints that decide who
 * owns an event on the monitor. A wrong payload shape here either
 *   (a) silently fails the backend validation (400 that the UI swallows),
 *   (b) overwrites another operator attendance object via the backend
 *       `$set` (the takeover bug we already guard against at the UI), or
 *   (c) leaves the attendance in IN_PROGRESS instead of CLOSED.
 *
 * These tests lock the payload shape and endpoint URL explicitly so any
 * future refactor has to be deliberate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { alertsService } from '@/services/alerts.service';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';

type AnyBody = Record<string, unknown>;

describe('alertsService attendance mutations', () => {
  let post: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        status: 200,
        result: {
          attendance: {
            isAttendance: true,
            status: 'IN_PROGRESS',
            openedDate: '2026-04-19T12:00:00Z',
          },
        },
      },
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('openAttendance', () => {
    it('POSTs to the attendanceEvent endpoint', async () => {
      await alertsService.openAttendance({
        patrolActionId: 'p1',
        operator: 'u1',
      });
      expect(post).toHaveBeenCalledTimes(1);
      expect(post.mock.calls[0][0]).toBe(endpoints.attendanceEvent);
    });

    it('sends { patrolActionId, attendance, siteGroup } with status IN_PROGRESS', async () => {
      await alertsService.openAttendance({
        patrolActionId: 'p1',
        operator: 'u1',
        siteGroup: 'sg1',
      });
      const body = post.mock.calls[0][1] as AnyBody;
      expect(body.patrolActionId).toBe('p1');
      expect(body.siteGroup).toBe('sg1');
      const att = body.attendance as AnyBody;
      expect(att.isAttendance).toBe(true);
      expect(att.status).toBe('IN_PROGRESS');
      expect(att.operator).toBe('u1');
      // openedDate must be an ISO-8601 timestamp - the backend parses it
      // back into a Date. Any invalid shape here gets silently dropped.
      expect(typeof att.openedDate).toBe('string');
      expect(new Date(att.openedDate as string).toString()).not.toBe('Invalid Date');
    });

    it('does NOT set closedDate on open (would make the record look already finished)', async () => {
      await alertsService.openAttendance({ patrolActionId: 'p1', operator: 'u1' });
      const att = (post.mock.calls[0][1] as AnyBody).attendance as AnyBody;
      expect(att.closedDate).toBeUndefined();
    });

    it('omits siteGroup cleanly when not supplied (undefined, not empty string)', async () => {
      await alertsService.openAttendance({ patrolActionId: 'p1', operator: 'u1' });
      const body = post.mock.calls[0][1] as AnyBody;
      // The backend treats empty string differently from undefined on
      // some DAOs. Explicit undefined is the safe wire value.
      expect(body.siteGroup).toBeUndefined();
    });
  });

  describe('closeAttendance', () => {
    it('POSTs to the attendanceEvent endpoint', async () => {
      await alertsService.closeAttendance({
        patrolActionId: 'p1',
        operator: 'u1',
      });
      expect(post.mock.calls[0][0]).toBe(endpoints.attendanceEvent);
    });

    it('sends attendance with status CLOSED and a closedDate ISO', async () => {
      await alertsService.closeAttendance({
        patrolActionId: 'p1',
        operator: 'u1',
      });
      const att = (post.mock.calls[0][1] as AnyBody).attendance as AnyBody;
      expect(att.status).toBe('CLOSED');
      expect(typeof att.closedDate).toBe('string');
      expect(new Date(att.closedDate as string).toString()).not.toBe('Invalid Date');
      // isAttendance remains true after close - that is what lets the
      // classifier distinguish "CLOSED" from "AVAILABLE".
      expect(att.isAttendance).toBe(true);
    });

    it('forwards the original openedDate so the record preserves history', async () => {
      const originalOpen = '2026-04-19T11:30:00Z';
      await alertsService.closeAttendance({
        patrolActionId: 'p1',
        operator: 'u1',
        openedDate: originalOpen,
      });
      const att = (post.mock.calls[0][1] as AnyBody).attendance as AnyBody;
      expect(att.openedDate).toBe(originalOpen);
    });

    it('records the operator id on the attendance object', async () => {
      await alertsService.closeAttendance({
        patrolActionId: 'p1',
        operator: 'op-42',
      });
      const att = (post.mock.calls[0][1] as AnyBody).attendance as AnyBody;
      expect(att.operator).toBe('op-42');
    });
  });

  describe('createAttendance (deprecated passthrough)', () => {
    it('still hits the attendanceEvent endpoint for legacy callers', async () => {
      await alertsService.createAttendance('p1', { isAttendance: true, status: 'IN_PROGRESS' });
      expect(post.mock.calls[0][0]).toBe(endpoints.attendanceEvent);
    });
  });
});

/**
 * Bug C2 — editing ALL recurrences of an alert schedule must persist.
 *
 * The series-update endpoint (ms-schedule ctr-schedule.alertCheckUpdateSchedule)
 * archives the old schedule and then CREATES a brand-new one through
 * `crud.generic.saveOrUpdate(false, ...)`. That create path looks the doc up by
 * primary key `_id`; if the outgoing payload still carries the existing
 * schedule's `_id`, the backend finds the just-archived doc and aborts with
 * `500 response.already.exists`. The replacement series is never written and the
 * operator sees "does not save". The schedule id therefore MUST travel on
 * `schedule` and the payload MUST NOT carry `_id`.
 *
 * The single-occurrence path (updateAppointmentOccurrence) is scoped by
 * `appointment` in a different controller and is unaffected by `_id` — these
 * tests lock that it keeps working unchanged.
 */
describe('alertsService schedule series vs occurrence updates', () => {
  let post: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { status: 200, result: {} } } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const seriesPayload = {
    _id: 'sched-existing-id',
    schedule: 'sched-existing-id',
    name: 'Series A',
    account: 'acc1',
    client: 'cli1',
    site: 'site1',
    equipment: 'eq1',
    frequency: 'DAILY' as const,
    category: 'ALERT_CHECK' as const,
    beginDate: '2026-06-01',
    endDate: '2026-06-30',
    beginHour: '08:00',
    endHour: '18:00',
    status: 'ACTIVE' as const,
    alertConfig: {
      alertType: 'FIXED' as const,
      fixedInterval: 30,
      durationMin: 2,
      volumeLevel: 80,
    },
  };

  describe('updateScheduleSeries (edit-series)', () => {
    it('POSTs to the AlertPort schedule-update endpoint', async () => {
      await alertsService.updateScheduleSeries(seriesPayload);
      expect(post.mock.calls[0][0]).toBe(endpoints.alertportScheduleUpdate);
    });

    it('strips `_id` so the backend create path does not hit response.already.exists', async () => {
      await alertsService.updateScheduleSeries(seriesPayload);
      const body = post.mock.calls[0][1] as AnyBody;
      // The whole bug: a stale `_id` makes saveOrUpdate(false) abort. It must
      // never reach the wire on a series update.
      expect('_id' in body).toBe(false);
    });

    it('keeps the schedule id on `schedule` (NOT `_id`)', async () => {
      await alertsService.updateScheduleSeries(seriesPayload);
      const body = post.mock.calls[0][1] as AnyBody;
      expect(body.schedule).toBe('sched-existing-id');
    });

    it('preserves the rest of the series payload unchanged', async () => {
      await alertsService.updateScheduleSeries(seriesPayload);
      const body = post.mock.calls[0][1] as AnyBody;
      expect(body.name).toBe('Series A');
      expect(body.beginDate).toBe('2026-06-01');
      expect(body.endDate).toBe('2026-06-30');
      expect(body.frequency).toBe('DAILY');
      expect(body.account).toBe('acc1');
    });
  });

  describe('updateAppointmentOccurrence (edit-occurrence) is unaffected', () => {
    it('POSTs to the AlertPort single-occurrence endpoint with appointment + schedule', async () => {
      await alertsService.updateAppointmentOccurrence({
        schedule: 'sched-existing-id',
        appointment: 'appt-1',
        name: 'Series A',
        category: 'ALERT_CHECK',
        beginDate: '2026-06-10',
        endDate: '2026-06-10',
        beginHour: '08:00',
        endHour: '18:00',
      });
      expect(post.mock.calls[0][0]).toBe(endpoints.appointmentAlertportUpdateOccurrence);
      const body = post.mock.calls[0][1] as AnyBody;
      // The occurrence controller is scoped by `appointment` — both ids ride
      // explicitly and there is no `_id` to strip here.
      expect(body.appointment).toBe('appt-1');
      expect(body.schedule).toBe('sched-existing-id');
      expect('_id' in body).toBe(false);
    });
  });
});
