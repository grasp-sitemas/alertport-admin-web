import { describe, expect, test } from 'vitest';
import {
  MONITOR_TIME_WINDOW_MAX_HOURS,
  MONITOR_TIME_WINDOW_MIN_HOURS,
  monitorSettingsSchema,
} from './schemas';

/**
 * The monitor event time-window is held as a string so the native number
 * input can be cleared. Empty string means "system default" (backend stores
 * null); a filled value must be an integer within [MIN, MAX]. These bounds
 * are load-bearing — a value outside them silently produces a window the
 * backend rejects.
 */
describe('monitorSettingsSchema', () => {
  const parse = (eventTimeWindowHours: string) =>
    monitorSettingsSchema.safeParse({ eventTimeWindowHours });

  test('accepts empty string (system default)', () => {
    expect(parse('').success).toBe(true);
  });

  test('accepts the minimum bound', () => {
    expect(parse(String(MONITOR_TIME_WINDOW_MIN_HOURS)).success).toBe(true);
  });

  test('accepts the maximum bound', () => {
    expect(parse(String(MONITOR_TIME_WINDOW_MAX_HOURS)).success).toBe(true);
  });

  test('rejects 0 (below minimum)', () => {
    expect(parse('0').success).toBe(false);
  });

  test('rejects 25 (above maximum)', () => {
    expect(parse('25').success).toBe(false);
  });

  test('rejects a non-integer float', () => {
    expect(parse('2.5').success).toBe(false);
  });

  test('surfaces the i18n error key on invalid input', () => {
    const result = parse('0');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('company.eventTimeWindowInvalid');
    }
  });
});
