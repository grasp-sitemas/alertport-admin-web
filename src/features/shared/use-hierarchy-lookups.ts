'use client';

import { useQuery } from '@tanstack/react-query';
import { companyService } from '@/services/company.service';
import { equipmentService } from '@/services/equipment.service';

/**
 * Cascading lookups for Account → Client → Site dropdowns, used by
 * Collaborator, Equipment, Site and other forms.
 *
 * All three call POST /api/company/filter/v1/ with the proper `type` and
 * optional parent scope. Results are cached for 5 minutes.
 */

export function useAccountsLookup() {
  return useQuery({
    queryKey: ['lookup', 'accounts'],
    queryFn: () =>
      companyService.filterAccounts({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
      }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientsLookup(account?: string) {
  return useQuery({
    queryKey: ['lookup', 'clients', account ?? ''],
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

export function useSitesLookup(client?: string) {
  return useQuery({
    queryKey: ['lookup', 'sites', client ?? ''],
    queryFn: () =>
      companyService.filterSites({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        ...(client ? { client } : {}),
      }),
    enabled: !!client,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Legacy `Services.getEquipmentsBySite()` uses type='DEVICE-PHONE' to filter
 * only AlertPort / phone-capable devices for scheduling.
 * When `deviceType` is omitted we use DEVICE-PHONE to match legacy behavior.
 */
export function useEquipmentsBySiteLookup(
  params: { account?: string; client?: string; site?: string; deviceType?: string } = {},
) {
  const { account, client, site, deviceType = 'DEVICE-PHONE' } = params;
  return useQuery({
    queryKey: ['lookup', 'equipments-by-site', account ?? '', client ?? '', site ?? '', deviceType],
    queryFn: () =>
      equipmentService.filter({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        type: deviceType,
        ...(account ? { account } : {}),
        ...(client ? { client } : {}),
        ...(site ? { site } : {}),
      }),
    enabled: !!site,
    staleTime: 2 * 60 * 1000,
  });
}
