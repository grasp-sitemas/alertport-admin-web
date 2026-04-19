'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { extractId } from '@/lib/utils';

export interface UserScope {
  accountId?: string;
  clientId?: string;
  siteId?: string;
  /**
   * `siteGroup` is the grouping an OPERATOR belongs to. ms-user writes live
   * attendance events (Firestore `updateAttendanceEvent/{siteGroupId}`) on
   * this id, so the monitor MUST subscribe to it to receive real-time
   * attendance updates.
   */
  siteGroupId?: string;
}

/**
 * Reads the user's hierarchy (account / client / site / siteGroup) from the
 * session user, mirroring `Common.getAccountId/getClientId/getSiteId` from
 * shieldgo-admin-web.
 *
 * Every filter / search endpoint in the legacy backend expects these fields in
 * the payload (empty or the user's own scope, never omitted). Use
 * `applyUserScope(params, scope)` to merge this automatically without
 * overwriting explicit UI filters.
 */
export function useUserScope(): UserScope {
  const { user } = useAuth();
  return useMemo<UserScope>(
    () => ({
      accountId: extractId(user?.account),
      clientId: extractId(user?.client),
      siteId: extractId(user?.site),
      // `siteGroup` is not declared on the typed User but ms-user/ms-company
      // hydrate it at login for OPERATOR sessions. Read it via a runtime cast
      // so we don't need to widen the User type (same pattern already used in
      // attendance-dialog.tsx).
      siteGroupId: extractId(
        (user as unknown as { siteGroup?: unknown })?.siteGroup,
      ),
    }),
    [user],
  );
}

/**
 * Merge the user's hierarchy IDs into a filter payload. Existing explicit
 * values on `params` (e.g. a client the user picked in the UI) always win.
 */
export function applyUserScope<T extends Record<string, unknown>>(
  params: T,
  scope: UserScope,
): T & { account?: string; client?: string; site?: string } {
  const next: T & { account?: string; client?: string; site?: string } = { ...params };
  if (scope.accountId && !next.account) next.account = scope.accountId;
  if (scope.clientId && !next.client) next.client = scope.clientId;
  if (scope.siteId && !next.site) next.site = scope.siteId;
  return next;
}
