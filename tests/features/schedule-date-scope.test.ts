import { describe, expect, it } from 'vitest';
import {
  addCivilDays,
  resolveCalendarInstantDay,
  resolveScheduleCivilDay,
  resolveScheduleEditBeginDate,
} from '@/features/alerts/schedule-date-scope';

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

describe('AlertPort calendar day semantics', () => {
  it('converts an appointment instant to the company-local calendar day', () => {
    expect(resolveCalendarInstantDay('2026-09-02T00:45:00.000Z', 'America/Sao_Paulo')).toBe(
      '2026-09-01',
    );
  });

  it('keeps a schedule midnight-UTC value as the persisted civil day', () => {
    expect(resolveScheduleCivilDay('2026-09-05T00:00:00.000Z')).toBe('2026-09-05');
  });

  it('advances civil days without depending on the browser timezone', () => {
    expect(addCivilDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
