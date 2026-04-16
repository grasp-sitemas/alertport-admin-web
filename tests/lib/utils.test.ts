import { describe, it, expect } from 'vitest';
import { cn, getInitials, getNestedValue } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deduplicates tailwind classes via twMerge', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6');
  });
});

describe('getInitials', () => {
  it('returns two letters', () => {
    expect(getInitials('John', 'Doe')).toBe('JD');
  });

  it('handles missing values', () => {
    expect(getInitials('John', undefined)).toBe('J');
    expect(getInitials(undefined, undefined)).toBe('');
  });
});

describe('getNestedValue', () => {
  it('resolves simple paths', () => {
    expect(getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('returns undefined for unknown paths', () => {
    expect(getNestedValue({ a: {} }, 'a.b.c')).toBeUndefined();
  });
});
