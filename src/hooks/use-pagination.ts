'use client';

import { useState, useCallback, useMemo } from 'react';
import type { PaginationParams } from '@/types/api';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  paginationParams: PaginationParams;
  resetPage: () => void;
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPage = 1, initialPageSize = 20 } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize],
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1); // reset to first page on page size change
  }, []);

  const resetPage = useCallback(() => setPage(1), []);

  // The legacy API uses "skip" as 1-indexed page number
  const paginationParams: PaginationParams = useMemo(
    () => ({
      skip: page,
      limit: pageSize,
    }),
    [page, pageSize],
  );

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setPageSize,
    setTotalCount,
    paginationParams,
    resetPage,
  };
}
