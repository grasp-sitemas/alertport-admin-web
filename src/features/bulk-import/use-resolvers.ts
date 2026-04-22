'use client';

import { useQuery } from '@tanstack/react-query';
import { companyService } from '@/services/company.service';
import { useAuth } from '@/hooks/use-auth';
import { buildNameResolver, type NameResolver } from './entity-configs';

/**
 * Fetches the account/client/site catalogs the bulk-import dialog
 * needs to resolve human-readable names in CSV cells. Lazy: the
 * `enabled` flag hinges on `enabled` so we only pay for the lookups
 * when the dialog is actually open.
 *
 * Scoping rules mirror the rest of the app:
 *   - SAM sees every account; non-SAM skip the accounts query.
 *   - Clients + sites are fetched under the session's own account
 *     for non-SAM. SAM can bulk-import into any tenant but the
 *     common case is "import into the currently-browsed account",
 *     so we still scope to `sessionAccountId` when present.
 *
 * All three queries fail-open: if the fetch errors, the resolver
 * returned is simply empty and parseRow falls back to ObjectId-only
 * behaviour (the user can still paste ids by hand).
 */
export function useBulkImportResolvers(params: {
  enabled: boolean;
  sessionAccountId: string | undefined;
}): {
  accountResolver: NameResolver;
  clientResolver: NameResolver;
  siteResolver: NameResolver;
  isLoading: boolean;
} {
  const { enabled, sessionAccountId } = params;
  const { userSubtype } = useAuth();
  const isSam = userSubtype === 'SUPER_ADMIN_MASTER';

  const accounts = useQuery({
    queryKey: ['bulk-import', 'resolver', 'accounts'],
    queryFn: () =>
      companyService.filterAccounts({ skip: 1, limit: 500, status: 'ACTIVE' }),
    enabled: enabled && isSam,
    staleTime: 5 * 60 * 1000,
  });

  const clients = useQuery({
    queryKey: ['bulk-import', 'resolver', 'clients', sessionAccountId ?? ''],
    queryFn: () =>
      companyService.filterClients({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        ...(sessionAccountId ? { account: sessionAccountId } : {}),
      }),
    enabled: enabled && (!!sessionAccountId || isSam),
    staleTime: 5 * 60 * 1000,
  });

  const sites = useQuery({
    queryKey: ['bulk-import', 'resolver', 'sites', sessionAccountId ?? ''],
    queryFn: () =>
      companyService.filterSites({
        skip: 1,
        limit: 500,
        status: 'ACTIVE',
        ...(sessionAccountId ? { account: sessionAccountId } : {}),
      }),
    enabled: enabled && (!!sessionAccountId || isSam),
    staleTime: 5 * 60 * 1000,
  });

  return {
    accountResolver: buildNameResolver(accounts.data?.results),
    clientResolver: buildNameResolver(clients.data?.results),
    siteResolver: buildNameResolver(sites.data?.results),
    isLoading: accounts.isLoading || clients.isLoading || sites.isLoading,
  };
}
