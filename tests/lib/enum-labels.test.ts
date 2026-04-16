import { describe, expect, it } from 'vitest';
import { formatEnumLabel, normalizeEnumToken } from '@/lib/enum-labels';

describe('normalizeEnumToken', () => {
  it('returns an uppercase trimmed token', () => {
    expect(normalizeEnumToken('  daily  ')).toBe('DAILY');
  });

  it('returns undefined for empty or non-string values', () => {
    expect(normalizeEnumToken('   ')).toBeUndefined();
    expect(normalizeEnumToken(undefined)).toBeUndefined();
    expect(normalizeEnumToken(null)).toBeUndefined();
  });
});

describe('formatEnumLabel', () => {
  it('maps known labels', () => {
    expect(formatEnumLabel('daily', { DAILY: 'Diário' })).toBe('Diário');
  });

  it('falls back to the normalized token when unknown', () => {
    expect(formatEnumLabel('custom_value', { DAILY: 'Diário' })).toBe('CUSTOM_VALUE');
  });

  it('falls back to a dash when value is missing', () => {
    expect(formatEnumLabel(undefined, { DAILY: 'Diário' })).toBe('—');
  });
});
