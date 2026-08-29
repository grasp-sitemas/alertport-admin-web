'use client';

import { useMemo, useState } from 'react';

interface UseClientPaginationOptions {
  initialPageSize?: number;
}

interface UseClientPaginationReturn<T> {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  paged: T[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Client-side pagination over an already-loaded array. Used by reports
 * pages whose backend returns the full result set in a single call: we
 * slice the array in memory so the DataTable's prev/next buttons
 * actually work without a refetch.
 *
 * Page auto-resets to 1 whenever the source array's identity changes
 * (e.g. new filter applied, refetch returned a different response) so
 * the user is never stranded on a page that no longer exists.
 */
export function useClientPagination<T>(
  rows: T[],
  options: UseClientPaginationOptions = {},
): UseClientPaginationReturn<T> {
  const { initialPageSize = 20 } = options;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [previousRows, setPreviousRows] = useState(rows);

  // Reset to page 1 when the underlying dataset changes - otherwise the
  // user could land on page 5 of an array that just shrunk to 2 rows.
  if (previousRows !== rows) {
    setPreviousRows(rows);
    setPage(1);
  }

  const totalCount = rows.length;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize],
  );

  // Clamp active page if the row count or page size shrinks.
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };

  return {
    page: safePage,
    pageSize,
    totalPages,
    totalCount,
    paged,
    setPage,
    setPageSize,
  };
}
