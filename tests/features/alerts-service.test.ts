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
