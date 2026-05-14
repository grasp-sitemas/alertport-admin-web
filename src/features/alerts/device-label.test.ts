import { describe, expect, test } from 'vitest';
import { isLegacyGwrondaAction, resolveCallTargetId } from './device-label';
import type { PatrolAction } from '@/types/api';

const base = {} as PatrolAction;

describe('isLegacyGwrondaAction', () => {
  test('legacyEventId present → true', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyEventId: '12345' })).toBe(true);
  });

  test('legacyEventType present → true', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyEventType: 7 })).toBe(true);
  });

  test('legacyReaderCode present → true', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyReaderCode: '354899040441351' })).toBe(true);
  });

  test('no legacy markers → false', () => {
    expect(isLegacyGwrondaAction(base)).toBe(false);
  });

  test('empty string legacyEventId → false (falsy)', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyEventId: '' })).toBe(false);
  });

  test('legacyEventType=0 → false (falsy — sanity)', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyEventType: 0 })).toBe(false);
  });
});

describe('resolveCallTargetId', () => {
  test('returns deviceId when present', () => {
    expect(resolveCallTargetId({ deviceInfo: { deviceId: 'abc-123' } } as PatrolAction)).toBe('abc-123');
  });

  test('returns null when deviceInfo missing', () => {
    expect(resolveCallTargetId({} as PatrolAction)).toBeNull();
  });

  test('returns null when deviceId missing', () => {
    expect(resolveCallTargetId({ deviceInfo: {} } as PatrolAction)).toBeNull();
  });
});
