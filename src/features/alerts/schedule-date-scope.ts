export type ScheduleEditMode = 'edit-series' | 'edit-occurrence';

const CIVIL_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

function isValidCivilDay(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

/**
 * Schedule ranges are persisted as civil dates. Even when Mongo serializes a
 * value as midnight UTC, converting that instant through the browser timezone
 * would move it to the previous day in the Americas.
 */
export function resolveScheduleCivilDay(value: string | null | undefined): string {
  if (!value) return '';
  const match = value.match(CIVIL_DAY_PATTERN);
  if (!match) return '';
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return isValidCivilDay(year, month, day) ? `${yearText}-${monthText}-${dayText}` : '';
}

/** Shift a civil calendar day without involving the browser timezone. */
export function addCivilDays(value: string, amount: number): string {
  const civilDay = resolveScheduleCivilDay(value);
  if (!civilDay || !Number.isInteger(amount)) return '';
  const [year, month, day] = civilDay.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return shifted.toISOString().slice(0, 10);
}

function formatInstantDay(value: Date, timezone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...(timezone ? { timeZone: timezone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}

/** Convert an appointment instant to the calendar day in the account timezone. */
export function resolveCalendarInstantDay(
  value: string | null | undefined,
  timezone?: string,
): string {
  if (!value) return '';
  if (value.length === 10) return resolveScheduleCivilDay(value);
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  try {
    return formatInstantDay(instant, timezone);
  } catch {
    // A malformed legacy account timezone must not make the scheduling page
    // unusable. The browser timezone is the established fallback.
    return formatInstantDay(instant);
  }
}

interface ResolveScheduleEditBeginDateInput {
  mode: ScheduleEditMode;
  clickedDay: string;
  persistedBeginDate: string;
}

/**
 * Series actions are defined by the calendar UX as "from this date onward".
 * The full-schedule fetch must not overwrite the appointment day the operator
 * selected, otherwise the backend regenerates the beginning of the old range.
 */
export function resolveScheduleEditBeginDate({
  mode,
  clickedDay,
  persistedBeginDate,
}: ResolveScheduleEditBeginDateInput): string {
  if ((mode === 'edit-series' || mode === 'edit-occurrence') && clickedDay) {
    return clickedDay;
  }
  return persistedBeginDate;
}
