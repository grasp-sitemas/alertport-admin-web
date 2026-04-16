import { describe, it, expect } from 'vitest';
import { normalizePage } from '@/lib/pagination';

describe('normalizePage', () => {
  it('returns empty page for null/undefined', () => {
    expect(normalizePage(null)).toEqual({ results: [], totalCount: 0 });
    expect(normalizePage(undefined)).toEqual({ results: [], totalCount: 0 });
  });

  it('normalizes flat response { results, totalCount }', () => {
    const input = { results: [{ id: 1 }, { id: 2 }], totalCount: 2 };
    expect(normalizePage(input)).toEqual({ results: [{ id: 1 }, { id: 2 }], totalCount: 2 });
  });

  it('falls back to array length when totalCount missing', () => {
    const input = { results: [{ id: 1 }] };
    expect(normalizePage(input)).toEqual({ results: [{ id: 1 }], totalCount: 1 });
  });

  it('normalizes aggregated shape with totalCount as array', () => {
    const input = {
      results: [{ paginatedResults: [{ id: 'a' }, { id: 'b' }], totalCount: [{ count: 42 }] }],
    };
    expect(normalizePage(input)).toEqual({
      results: [{ id: 'a' }, { id: 'b' }],
      totalCount: 42,
    });
  });

  it('normalizes aggregated shape with totalCount as number', () => {
    const input = {
      results: [{ paginatedResults: [{ id: 'x' }], totalCount: 7 }],
    };
    expect(normalizePage(input)).toEqual({ results: [{ id: 'x' }], totalCount: 7 });
  });

  it('returns empty when aggregated has no paginatedResults', () => {
    const input = { results: [{ paginatedResults: [], totalCount: [] }] };
    expect(normalizePage(input)).toEqual({ results: [], totalCount: 0 });
  });
});
