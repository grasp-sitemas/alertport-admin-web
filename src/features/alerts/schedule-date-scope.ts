export type ScheduleEditMode = 'edit-series' | 'edit-occurrence';

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
