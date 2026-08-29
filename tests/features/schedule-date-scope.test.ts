import { describe, expect, it } from 'vitest';
import { resolveScheduleEditBeginDate } from '@/features/alerts/schedule-date-scope';

describe('resolveScheduleEditBeginDate', () => {
  it('starts a series edit on the calendar day the operator selected', () => {
    expect(
      resolveScheduleEditBeginDate({
        mode: 'edit-series',
        clickedDay: '2026-08-26',
        persistedBeginDate: '2026-04-01',
      }),
    ).toBe('2026-08-26');
  });

  it('keeps the persisted begin date when there is no appointment day', () => {
    expect(
      resolveScheduleEditBeginDate({
        mode: 'edit-series',
        clickedDay: '',
        persistedBeginDate: '2026-04-01',
      }),
    ).toBe('2026-04-01');
  });

  it('pins a single-occurrence edit to the selected calendar day', () => {
    expect(
      resolveScheduleEditBeginDate({
        mode: 'edit-occurrence',
        clickedDay: '2026-08-26',
        persistedBeginDate: '2026-04-01',
      }),
    ).toBe('2026-08-26');
  });
});
