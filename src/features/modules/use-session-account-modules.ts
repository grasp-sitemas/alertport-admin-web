'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountModulesService } from '@/services/account-modules.service';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';

/**
 * Read the module (feature-flag) map for the logged-in user's account.
 *
 * Behaviour contract:
 *   - SUPER_ADMIN_MASTER is the platform-level role and does not belong
 *     to a tenant account. Returns an empty map + `isSuperAdmin: true`
 *     so callers know to bypass enforcement (SAM needs to see every
 *     feature to administer it).
 *   - For other roles, fetches the account module state via the same
 *     endpoint the /modules page writes. The server fills missing keys
 *     with the catalog defaults (all true today) so a brand-new account
 *     behaves as if every module was enabled, never locked out.
 *   - On error or while loading, `isEnabled()` returns true - fail-open.
 *     A transient network failure must never hide the whole sidebar.
 */
export function useSessionAccountModules() {
  const { user, userSubtype } = useAuth();
  const isSuperAdmin = isSuperAdminMaster(userSubtype);

  // Session user.account can be a populated object or a raw id string.
  const accountId =
    typeof user?.account === 'object' && user.account
      ? (user.account as { _id?: string })._id
      : typeof user?.account === 'string'
        ? user.account
        : undefined;

  const query = useQuery({
    queryKey: ['account-modules', 'session', accountId ?? ''],
    queryFn: () => accountModulesService.getByAccount(accountId as string),
    enabled: !isSuperAdmin && !!accountId,
    // Module state changes infrequently - SAM edits it rarely and the
    // effect on the session is the operator's sidebar. 5min cache keeps
    // navigation responsive without hammering the backend.
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const modulesMap = query.data?.modules ?? null;

  return useMemo(
    () => ({
      isSuperAdmin,
      accountId,
      isLoading: query.isLoading,
      isError: query.isError,
      /**
       * Is module `key` enabled for this account?
       *   - SAM always sees every module (returns true).
       *   - While the query is loading or errored, returns true so the
       *     UI is never locked out by a transient failure.
       *   - If the key isn't in the server map (shouldn't happen because
       *     the backend fills defaults), returns true to stay fail-open.
       */
      isEnabled(key: string): boolean {
        if (isSuperAdmin) return true;
        if (!modulesMap) return true;
        const value = modulesMap[key];
        if (value === undefined) return true;
        return value === true;
      },
    }),
    [isSuperAdmin, accountId, query.isLoading, query.isError, modulesMap],
  );
}
