'use client';

import { useQuery } from '@tanstack/react-query';
import { companyService } from '@/services/company.service';

/**
 * Lightweight lookup of active clients for dropdowns inside the Sites form.
 * Uses the same /api/company/filter/v1/ endpoint with type: 'CLIENT'.
 */
export function useClientsLookup(account?: string) {
  return useQuery({
    queryKey: ['clients-lookup', account ?? ''],
    queryFn: () =>
      companyService.filterClients({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        ...(account ? { account } : {}),
      }),
    staleTime: 5 * 60 * 1000,
  });
}
