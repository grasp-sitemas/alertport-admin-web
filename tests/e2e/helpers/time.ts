/**
 * Date/time helpers for scheduling-related specs.
 *
 * AlertPort scheduling uses pt-BR formatting (`dd/MM/yyyy`, `HH:mm`).
 * Centralized so each spec doesn't reinvent the wheel and drift on
 * timezone handling.
 */

/** Returns `dd/MM/yyyy` in the local timezone. */
export function formatDateBR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** Returns `HH:mm` (24h) in the local timezone. */
export function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Returns a new Date offset by N days from `from` (default now). Pure. */
export function addDays(days: number, from: Date = new Date()): Date {
  const result = new Date(from.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
