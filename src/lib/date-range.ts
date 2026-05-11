/**
 * Date range helpers for report filters.
 *
 * The reports panel uses native `<input type="date">` which yields
 * `YYYY-MM-DD` strings. When that raw string is sent to the backend
 * and parsed with `new Date(...)`, JavaScript interprets it as UTC
 * midnight (00:00 UTC). For an operator in `America/Sao_Paulo` (UTC-3)
 * picking "today" with `endDate = startDate = 2026-05-09`:
 *
 *   - startDate parsed as 2026-05-09T00:00:00Z → 2026-05-08T21:00 BRT
 *   - endDate parsed as   2026-05-09T00:00:00Z → 2026-05-08T21:00 BRT
 *
 * The Mongo query `eventDate >= startDate AND eventDate <= endDate`
 * then matches a 0-second window in the past — so picking the current
 * date never finds any events of "today" in the operator's timezone.
 *
 * Fix: widen the boundaries at the edge of the system, expressing
 * `startDate` as start-of-day and `endDate` as end-of-day, both in
 * the operator's local timezone, then convert to ISO. The backend
 * accepts full ISO strings (see ms-report/helpers/alertport-report-helpers.js
 * `parseFilter`, which calls `new Date(body.startDate)` directly).
 *
 * RP5 — Flavio: "Quero poder ver só a data corrente. Ele nao busca
 * assim. Eventos atendidos até o momento e o que estiver pendente a
 * partir dele."
 */

const YYYY_MM_DD = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseYmd(yyyymmdd: string): { y: number; m: number; d: number } | null {
  const match = YYYY_MM_DD.exec(yyyymmdd);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
}

/**
 * Convert a `YYYY-MM-DD` date string to ISO at 00:00:00.000 in the
 * operator's local timezone. If the input is not in the expected
 * format, the original string is returned untouched (the caller's
 * upstream validation will surface the error).
 */
export function toIsoStartOfDay(yyyymmdd: string): string {
  const parts = parseYmd(yyyymmdd);
  if (!parts) return yyyymmdd;
  // `new Date(y, mIndex, d, ...)` interprets components in local TZ.
  const local = new Date(parts.y, parts.m - 1, parts.d, 0, 0, 0, 0);
  return local.toISOString();
}

/**
 * Convert a `YYYY-MM-DD` date string to ISO at 23:59:59.999 in the
 * operator's local timezone. Mirrors `toIsoStartOfDay` so that
 * `eventDate <= endDate` Mongo queries include the full last day.
 */
export function toIsoEndOfDay(yyyymmdd: string): string {
  const parts = parseYmd(yyyymmdd);
  if (!parts) return yyyymmdd;
  const local = new Date(parts.y, parts.m - 1, parts.d, 23, 59, 59, 999);
  return local.toISOString();
}

/**
 * Convenience for the common case of expanding the `(startDate, endDate)`
 * pair coming out of the report filter panel into full-day ISO bounds.
 */
export function expandDateRange(range: { startDate: string; endDate: string }): {
  startDate: string;
  endDate: string;
} {
  return {
    startDate: toIsoStartOfDay(range.startDate),
    endDate: toIsoEndOfDay(range.endDate),
  };
}
