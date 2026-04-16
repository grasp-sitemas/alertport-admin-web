'use client';

import { useState, useCallback } from 'react';
import type { FilterParams } from '@/types/api';
import { getSessionUser } from '@/lib/session';

interface UseFiltersOptions {
  initialFilters?: Record<string, unknown>;
  autoScopeByHierarchy?: boolean;
}

export function useFilters({ initialFilters = {}, autoScopeByHierarchy = true }: UseFiltersOptions = {}) {
  const [filters, setFiltersState] = useState<Record<string, unknown>>(initialFilters);

  const setFilter = useCallback((key: string, value: unknown) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(initialFilters);
  }, [initialFilters]);

  const setFilters = useCallback((newFilters: Record<string, unknown>) => {
    setFiltersState(newFilters);
  }, []);

  const buildFilterParams = useCallback(
    (paginationParams: { skip: number; limit: number }): FilterParams => {
      const params: FilterParams = {
        ...paginationParams,
        ...filters,
      };

      // Auto-scope filters based on user hierarchy (legacy behavior)
      if (autoScopeByHierarchy) {
        const user = getSessionUser();
        if (user) {
          if (user.account && typeof user.account === 'object' && !params.account) {
            params.account = user.account._id;
          }
          if (user.client && typeof user.client === 'object' && !params.client) {
            params.client = user.client._id;
          }
          if (user.site && typeof user.site === 'object' && !params.site) {
            params.site = user.site._id;
          }
        }
      }

      return params;
    },
    [filters, autoScopeByHierarchy],
  );

  return {
    filters,
    setFilter,
    setFilters,
    clearFilters,
    buildFilterParams,
  };
}
