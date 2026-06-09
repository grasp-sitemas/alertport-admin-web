/**
 * Contract tests for the reports service at src/services/reports.service.ts.
 *
 * Each of the four AlertPort reports must hit the exact endpoint ms-report
 * exposes under its alertport/<type>/v1 path. A renamed endpoint constant
 * silently 404s on a real backend, so we lock them in here.
 *
 * Strategy: stub the apiClient post method and assert (1) URL matches the
 * endpoints config verbatim, (2) body includes the required filter fields
 * (startDate, endDate, optional account/client/site), (3) the backend
 * envelope is returned untouched so callers read summary/results/totalCount
 * directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportsService } from '@/services/reports.service';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';

type PostSpy = ReturnType<typeof vi.spyOn>;

function makeEnvelope(summary: Record<string, unknown>) {
  return {
    status: 200,
    messageId: 'response.msg.success',
    summary,
    results: [{ _id: 'r1' }],
    totalCount: 1,
    generatedAt: '2026-04-19T12:00:00Z',
    durationMs: 12,
  };
}

describe('reportsService', () => {
  let postSpy: PostSpy;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    postSpy = vi.spyOn(apiClient, 'post').mockImplementation(((url: string) => {
      const summary = url.includes('adherence')
        ? { total: 10, adherenceRate: 87.5 }
        : url.includes('attendance')
          ? { total: 20, uniqueUsers: 3 }
          : url.includes('sos')
            ? { total: 5, attendedRate: 100 }
            : { total: 3, slaCompliance: 80 };
      return Promise.resolve({ data: makeEnvelope(summary) });
    }) as never) as PostSpy;
  });

  describe('contract: endpoint URLs', () => {
    it('adherence POSTs to /api/reports/alertport/adherence/v1/', async () => {
      await reportsService.adherence({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy.mock.calls[0][0]).toBe(endpoints.reportsAdherence);
    });

    it('attendance POSTs to /api/reports/alertport/attendance/v1/', async () => {
      await reportsService.attendance({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });
      expect(postSpy.mock.calls[0][0]).toBe(endpoints.reportsAttendance);
    });

    it('sos POSTs to /api/reports/alertport/sos/v1/', async () => {
      await reportsService.sos({ startDate: '2026-04-01', endDate: '2026-04-30' });
      expect(postSpy.mock.calls[0][0]).toBe(endpoints.reportsSos);
    });

    it('sla POSTs to /api/reports/alertport/sla/v1/', async () => {
      await reportsService.sla({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });
      expect(postSpy.mock.calls[0][0]).toBe(endpoints.reportsSla);
    });
  });

  describe('contract: body shape', () => {
    it('forwards startDate + endDate verbatim (required fields)', async () => {
      await reportsService.adherence({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });
      const body = postSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(body.startDate).toBe('2026-04-01');
      expect(body.endDate).toBe('2026-04-30');
    });

    it('forwards optional account/client/site when provided', async () => {
      await reportsService.sos({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        account: 'acc1',
        client: 'cli1',
        site: 'sit1',
      });
      const body = postSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(body.account).toBe('acc1');
      expect(body.client).toBe('cli1');
      expect(body.site).toBe('sit1');
    });

    it('forwards slaThresholdSec specifically to the SLA endpoint', async () => {
      await reportsService.sla({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        slaThresholdSec: 30,
      });
      const body = postSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(body.slaThresholdSec).toBe(30);
    });

    it('requests the full result set (limit) so exports are not capped at the 50-row default', async () => {
      // ms-report defaults `limit` to 50 when absent (clamped to 10000).
      // The report pages paginate the result set CLIENT-side, so a missing
      // limit silently truncates both the table (pages beyond 50) and the
      // CSV/XLSX/PDF exports. The service must request the full set.
      await reportsService.adherence({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      });
      const body = postSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(typeof body.limit).toBe('number');
      expect(body.limit as number).toBeGreaterThanOrEqual(10000);
    });

    it('respects an explicit caller-provided limit', async () => {
      await reportsService.adherence({
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        limit: 25,
      });
      const body = postSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(body.limit).toBe(25);
    });
  });

  describe('contract: response shape', () => {
    it('adherence returns the envelope unwrapped', async () => {
      const res = await reportsService.adherence({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
      });
      expect(res.summary).toEqual({ total: 10, adherenceRate: 87.5 });
      expect(res.results).toHaveLength(1);
      expect(res.totalCount).toBe(1);
      expect(res.generatedAt).toBeTruthy();
      expect(typeof res.durationMs).toBe('number');
    });

    it('sla returns summary with compliance metric', async () => {
      const res = await reportsService.sla({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
      });
      expect(res.summary).toHaveProperty('slaCompliance');
    });
  });
});
