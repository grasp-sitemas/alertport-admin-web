import { describe, it, expect } from 'vitest';
import {
  defaultReportRange,
  MAX_RANGE_DAYS,
  rangeErrorKey,
  validateReportFilter,
} from '@/features/reports/report-filter-validator';

// These rules run client-side AND server-side (see
// `alertport-report-helpers.js::parseFilter` — 30-day cap). A regression
// here means either a guaranteed-failure network round-trip or — worse —
// an expensive aggregation query that gets stopped at the server. Both
// are user-visible latency spikes.

describe('validateReportFilter', () => {
  it('requires both startDate and endDate', () => {
    expect(validateReportFilter({ startDate: '', endDate: '2026-01-01' })).toMatchObject({
      ok: false,
      error: 'START_REQUIRED',
    });
    expect(validateReportFilter({ startDate: '2026-01-01', endDate: '' })).toMatchObject({
      ok: false,
      error: 'END_REQUIRED',
    });
  });

  it('rejects unparseable date strings', () => {
    expect(
      validateReportFilter({ startDate: 'not-a-date', endDate: '2026-01-01' }),
    ).toMatchObject({ ok: false, error: 'INVALID_DATE' });
  });

  it('rejects end-before-start', () => {
    expect(
      validateReportFilter({ startDate: '2026-01-10', endDate: '2026-01-01' }),
    ).toMatchObject({ ok: false, error: 'END_BEFORE_START' });
  });

  it('accepts same-day range (1 day inclusive)', () => {
    const v = validateReportFilter({ startDate: '2026-01-01', endDate: '2026-01-01' });
    expect(v.ok).toBe(true);
    expect(v.rangeDays).toBe(1);
  });

  it('accepts exactly 30 days', () => {
    const v = validateReportFilter({ startDate: '2026-01-01', endDate: '2026-01-30' });
    expect(v.ok).toBe(true);
    expect(v.rangeDays).toBe(30);
  });

  it('rejects ranges > 30 days and reports the actual size', () => {
    const v = validateReportFilter({ startDate: '2026-01-01', endDate: '2026-02-05' });
    expect(v.ok).toBe(false);
    expect(v.error).toBe('RANGE_EXCEEDED');
    expect(v.rangeDays).toBeGreaterThan(MAX_RANGE_DAYS);
  });
});

describe('rangeErrorKey', () => {
  it('maps every error code to an i18n key', () => {
    const codes = [
      'START_REQUIRED',
      'END_REQUIRED',
      'INVALID_DATE',
      'END_BEFORE_START',
      'RANGE_EXCEEDED',
    ] as const;
    for (const code of codes) {
      expect(rangeErrorKey(code)).toMatch(/^(reports|common)\./);
    }
  });

  it('falls back to a safe default when the code is undefined', () => {
    expect(rangeErrorKey(undefined)).toBeTruthy();
  });
});

describe('defaultReportRange', () => {
  it('returns an ISO date range that is always valid', () => {
    const r = defaultReportRange();
    const v = validateReportFilter(r);
    expect(v.ok).toBe(true);
    // Sanity: endDate is the "today" marker.
    expect(r.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
