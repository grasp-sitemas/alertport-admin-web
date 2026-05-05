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
 *   - While LOADING the very first response, `isEnabled()` returns true
 *     so the UI doesn't flash a "not allowed" screen on initial paint.
 *     ModuleGuard renders its own Spinner during this window.
 *   - On ERROR, `isEnabled()` returns false for non-SAM (fail-CLOSED).
 *     This map drives billing / trial / paid-feature gating; a 5xx
 *     must NOT silently grant access to a disabled module. ModuleGuard
 *     surfaces a "couldn't verify access" retry UI.
 *
 * The hook also exposes `refetch()` so the retry UI can re-attempt
 * the call without forcing a full page reload.
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
    // Two automatic retries before we surface the error - covers the
    // common "Heroku dyno restart" 503 without bothering the operator.
    retry: 2,
  });

  const modulesMap = query.data?.modules ?? null;

  return useMemo(
    () => ({
      isSuperAdmin,
      accountId,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: () => {
        void query.refetch();
      },
      /**
       * Is module `key` enabled for this account?
       *   - SAM always sees every module (returns true).
       *   - On error: returns false (fail-closed). The caller should
       *     branch on `isError` and render a retry UI.
       *   - While loading: returns true so the very first paint isn't
       *     a "not allowed" screen. The caller's `isLoading` branch
       *     is responsible for the spinner.
       *   - Missing key in the map (server contract bug): returns true
       *     to stay fail-soft. The backend is supposed to fill defaults.
       */
      isEnabled(key: string): boolean {
        if (isSuperAdmin) return true;
        if (query.isError) return false;
        if (!modulesMap) return true;
        const value = modulesMap[key];
        if (value === undefined) return true;
        return value === true;
      },
    }),
    [isSuperAdmin, accountId, query.isLoading, query.isError, modulesMap, query],
  );
}
