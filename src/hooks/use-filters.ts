'use client';

import { useState, useCallback } from 'react';
import type { FilterParams } from '@/types/api';
import { getSessionUser } from '@/lib/session';
import { extractId } from '@/lib/utils';

interface UseFiltersOptions {
  initialFilters?: Record<string, unknown>;
  autoScopeByHierarchy?: boolean;
}

export function useFilters({
  initialFilters = {},
  autoScopeByHierarchy = true,
}: UseFiltersOptions = {}) {
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

      // Auto-scope filters based on user hierarchy (mirrors legacy Common.getAccountId
      // / getClientId / getSiteId). Handles both populated objects and bare IDs.
      // UI filters already present on `params` always win.
      if (autoScopeByHierarchy) {
        const user = getSessionUser();
        if (user) {
          const accountId = extractId(user.account);
          const clientId = extractId(user.client);
          const siteId = extractId(user.site);
          if (accountId && !params.account) params.account = accountId;
          if (clientId && !params.client) params.client = clientId;
          if (siteId && !params.site) params.site = siteId;
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
