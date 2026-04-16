/**
 * Mirrors `applyServerPage()` from `shieldgo-admin-web/src/utils/serverPaginationMixin.js`.
 *
 * Backend filter endpoints return two possible shapes:
 *   - Flat:       { results: [...], totalCount: N }
 *   - Aggregated: { results: [{ paginatedResults: [...], totalCount: [{ count: N }] | N }] }
 *
 * This helper normalizes both into `{ results, totalCount }`. Use it wherever
 * a service returns `ApiPaginatedResponse<T>` so the UI never has to care.
 */

export interface NormalizedPage<T> {
  results: T[];
  totalCount: number;
}

interface MaybeAggregated<T> {
  results?: T[] | Array<{ paginatedResults?: T[]; totalCount?: number | Array<{ count?: number }> }>;
  totalCount?: number;
  total?: number;
}

export function normalizePage<T>(response: MaybeAggregated<T> | null | undefined): NormalizedPage<T> {
  if (!response) return { results: [], totalCount: 0 };

  const results = response.results;

  if (
    Array.isArray(results) &&
    results.length === 1 &&
    typeof results[0] === 'object' &&
    results[0] !== null &&
    'paginatedResults' in (results[0] as object)
  ) {
    const first = results[0] as { paginatedResults?: T[]; totalCount?: number | Array<{ count?: number }> };
    const tc = first.totalCount;
    const total = Array.isArray(tc) ? tc[0]?.count ?? 0 : tc ?? 0;
    return {
      results: first.paginatedResults ?? [],
      totalCount: total,
    };
  }

  const flatResults = (Array.isArray(results) ? (results as T[]) : []) ?? [];
  return {
    results: flatResults,
    totalCount: response.totalCount ?? response.total ?? flatResults.length,
  };
}
