'use client';

import { useQuery } from '@tanstack/react-query';
import { companyService } from '@/services/company.service';
import { equipmentService } from '@/services/equipment.service';
import { useUserScope } from '@/hooks/use-user-scope';

/**
 * Cascading lookups for Account → Client → Site dropdowns and Equipment,
 * used by Collaborator, Equipment, Site, Alert Schedule and other forms.
 *
 * All lookups auto-scope to the currently logged-in user's hierarchy when
 * no explicit parent is given — this matches the legacy shieldgo service
 * calls `getClients` / `getSites` that pick up `Common.getAccountId` /
 * `Common.getClientId` from the session.
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
  const scope = useUserScope();
  // Explicit account arg wins; otherwise scope to the session user's account.
  const effectiveAccount = account || scope.accountId || '';
  return useQuery({
    queryKey: ['lookup', 'clients', effectiveAccount],
    queryFn: () =>
      companyService.filterClients({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        ...(effectiveAccount ? { account: effectiveAccount } : {}),
      }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSitesLookup(client?: string) {
  const scope = useUserScope();
  const effectiveAccount = scope.accountId;
  const effectiveClient = client || scope.clientId;

  return useQuery({
    queryKey: [
      'lookup',
      'sites',
      effectiveAccount ?? '',
      effectiveClient ?? '',
    ],
    queryFn: () =>
      companyService.filterSites({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        ...(effectiveAccount ? { account: effectiveAccount } : {}),
        ...(effectiveClient ? { client: effectiveClient } : {}),
      }),
    enabled: !!(effectiveAccount || effectiveClient),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Legacy `Services.getEquipmentsBySite()` uses `type='DEVICE-PHONE'` to filter
 * only AlertPort / phone-capable devices for scheduling.
 * If no explicit `site` is passed, the hook auto-scopes to the session user's
 * site (if any); the service payload always includes account/client/site when
 * available so the backend respects the hierarchy scope.
 */
export function useEquipmentsBySiteLookup(
  params: { account?: string; client?: string; site?: string; deviceType?: string } = {},
) {
  const scope = useUserScope();
  const effectiveAccount = params.account || scope.accountId;
  const effectiveClient = params.client || scope.clientId;
  const effectiveSite = params.site || scope.siteId;
  const deviceType = params.deviceType ?? 'DEVICE-PHONE';

  return useQuery({
    queryKey: [
      'lookup',
      'equipments-by-site',
      effectiveAccount ?? '',
      effectiveClient ?? '',
      effectiveSite ?? '',
      deviceType,
    ],
    queryFn: () =>
      equipmentService.filter({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        type: deviceType,
        ...(effectiveAccount ? { account: effectiveAccount } : {}),
        ...(effectiveClient ? { client: effectiveClient } : {}),
        ...(effectiveSite ? { site: effectiveSite } : {}),
      }),
    enabled: !!effectiveSite,
    staleTime: 2 * 60 * 1000,
  });
}
