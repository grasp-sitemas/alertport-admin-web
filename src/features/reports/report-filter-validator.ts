import type { ReportFilterParams } from '@/types/reports';

/**
 * Shared client-side validator for every report's filter panel.
 *
 * Backend enforces the same rules (see
 * `ms-report/helpers/alertport-report-helpers.js::parseFilter`), but
 * we replicate them here so we never POST a guaranteed-failure request
 * - keeps network round-trips cheap and the error message instant.
 */

export const MAX_RANGE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReportFilterError =
  | 'START_REQUIRED'
  | 'END_REQUIRED'
  | 'INVALID_DATE'
  | 'END_BEFORE_START'
  | 'RANGE_EXCEEDED';

export interface ReportFilterValidation {
  ok: boolean;
  error?: ReportFilterError;
  rangeDays?: number;
}

export function validateReportFilter(
  params: Pick<ReportFilterParams, 'startDate' | 'endDate'>,
): ReportFilterValidation {
  if (!params.startDate) return { ok: false, error: 'START_REQUIRED' };
  if (!params.endDate) return { ok: false, error: 'END_REQUIRED' };
  const start = Date.parse(params.startDate);
  const end = Date.parse(params.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, error: 'INVALID_DATE' };
  }
  if (end < start) return { ok: false, error: 'END_BEFORE_START' };
  const rangeDays = Math.floor((end - start) / MS_PER_DAY) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return { ok: false, error: 'RANGE_EXCEEDED', rangeDays };
  }
  return { ok: true, rangeDays };
}

export function rangeErrorKey(error: ReportFilterError | undefined): string {
  switch (error) {
    case 'START_REQUIRED':
    case 'END_REQUIRED':
      return 'reports.errors.datesRequired';
    case 'INVALID_DATE':
      return 'reports.errors.invalidDate';
    case 'END_BEFORE_START':
      return 'reports.errors.endBeforeStart';
    case 'RANGE_EXCEEDED':
      return 'reports.errors.rangeExceeded';
    default:
      return 'common.noData';
  }
}

/**
 * Reasonable default: last 7 days. Guarantees validity and usually
 * gives the operator a meaningful first view without them picking dates.
 */
export function defaultReportRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6); // inclusive 7-day window
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
