'use client';

import { useQuery } from '@tanstack/react-query';
import { companyService } from '@/services/company.service';
import { equipmentService } from '@/services/equipment.service';
import { useUserScope } from '@/hooks/use-user-scope';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';

/**
 * Cascading lookups for Account → Client → Site → Equipment.
 *
 * Mirrors the legacy shieldgo behaviour:
 *   1. Accounts load ONLY for SUPER_ADMIN_MASTER (other roles don't pick an
 *      account - theirs is fixed in the session).
 *   2. Clients load ONLY once an account is known (either picked in the UI
 *      by a super admin, or pulled from the session user for ADMIN+).
 *   3. Sites load ONLY once a client is known.
 *   4. Equipments load ONLY once a site is known.
 *
 * This avoids firing three parallel "list all" queries on page load and
 * matches the `changeAccount` / `changeClient` flow from the legacy code.
 */

export function useAccountsLookup() {
  const { userSubtype } = useAuth();
  const enabled = isSuperAdminMaster(userSubtype);
  return useQuery({
    queryKey: ['lookup', 'accounts'],
    queryFn: () =>
      companyService.filterAccounts({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientsLookup(account?: string) {
  const scope = useUserScope();
  // Explicit account arg wins; otherwise use the session user's own account.
  const effectiveAccount = account || scope.accountId;

  return useQuery({
    queryKey: ['lookup', 'clients', effectiveAccount ?? ''],
    queryFn: () =>
      companyService.filterClients({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        account: effectiveAccount,
      }),
    // Do not fire until we know WHICH account to scope by - legacy changeAccount
    // pattern: clients are only loaded after an account is chosen.
    enabled: !!effectiveAccount,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * `account` is optional but - when available - *always* goes on the
 * payload. The legacy backend's auto-scope rules blow up when a non-SAM
 * user queries `type=SITE` with only `client`: multi-tenant guards
 * intercept it and the endpoint returns an empty list. Passing `account`
 * gives the server everything it needs to apply the correct role-based
 * visibility without guessing.
 */
export function useSitesLookup(client?: string, account?: string) {
  const scope = useUserScope();
  const effectiveClient = client || scope.clientId;
  const effectiveAccount = account || scope.accountId;

  return useQuery({
    // Keyed by both account AND client so React Query re-fetches on any
    // hierarchy change (SUPER_ADMIN_MASTER switching accounts, operator
    // picking a different client of their own account).
    queryKey: ['lookup', 'sites', effectiveAccount ?? '', effectiveClient ?? ''],
    queryFn: () =>
      companyService.filterSites({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        ...(effectiveAccount ? { account: effectiveAccount } : {}),
        client: effectiveClient,
      }),
    enabled: !!effectiveClient,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Legacy `Services.getEquipmentsBySite()` uses `type='DEVICE-PHONE'` to filter
 * only AlertPort / phone-capable devices for scheduling.
 * Fires only once a site is known.
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
