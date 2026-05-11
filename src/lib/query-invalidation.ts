import type { QueryClient } from '@tanstack/react-query';

/**
 * Which entity kind was just mutated. Every mutation in the app that creates,
 * updates, archives or deletes one of these should call
 * `invalidateHierarchyAfter(queryClient, kind)` from its `onSuccess`/`onError`
 * handler so the cascading lookups stay in sync.
 */
export type MutatedKind = 'account' | 'client' | 'site' | 'equipment' | 'user';

/**
 * Invalidate every React Query cache that depends - directly or transitively -
 * on the mutated entity. This keeps cascading dropdowns fresh across the
 * whole app after creating, editing or archiving a client / site / equipment /
 * user, without forcing the operator to reload the page.
 *
 * Dependency map:
 *   account      → lookup.accounts, lookup.clients, lookup.sites,
 *                  lookup.equipments-by-site, accounts, clients, sites,
 *                  equipment
 *   client       → lookup.clients, lookup.sites, lookup.equipments-by-site,
 *                  clients, sites, equipment
 *   site         → lookup.sites, lookup.equipments-by-site, sites, equipment
 *   equipment    → lookup.equipments-by-site, equipment
 *   user         → users, collaborators
 *
 * React Query's `invalidateQueries` uses a prefix-match by default, so passing
 * `['lookup', 'clients']` invalidates every specific scope
 * (`['lookup', 'clients', '<accountId>']`) in one call. Currently-mounted
 * queries refetch immediately; unmounted ones are marked stale and refetch
 * next time they mount.
 */
export function invalidateHierarchyAfter(
  queryClient: QueryClient,
  kind: MutatedKind,
): void {
  const invalidate = (queryKey: readonly unknown[]) =>
    queryClient.invalidateQueries({ queryKey });

  switch (kind) {
    case 'account':
      invalidate(['lookup', 'accounts']);
      invalidate(['lookup', 'clients']);
      invalidate(['lookup', 'sites']);
      invalidate(['lookup', 'equipments-by-site']);
      invalidate(['accounts']);
      invalidate(['clients']);
      invalidate(['sites']);
      invalidate(['equipment']);
      break;
    case 'client':
      // A client mutation moves the Account → Client → Site → Equipment
      // cascade. Invalidate every downstream lookup so the next "pick a
      // client" / "pick a site" dropdown shows the right options.
      invalidate(['lookup', 'clients']);
      invalidate(['lookup', 'sites']);
      invalidate(['lookup', 'equipments-by-site']);
      invalidate(['clients']);
      invalidate(['sites']);
      invalidate(['equipment']);
      break;
    case 'site':
      invalidate(['lookup', 'sites']);
      invalidate(['lookup', 'equipments-by-site']);
      invalidate(['sites']);
      invalidate(['equipment']);
      break;
    case 'equipment':
      invalidate(['lookup', 'equipments-by-site']);
      invalidate(['equipment']);
      break;
    case 'user':
      invalidate(['users']);
      invalidate(['collaborators']);
      break;
  }
}

/**
 * Invalidate every cache that the Alert Monitor / Attendance flow reads.
 *
 * Used after attendance mutations (open / addRecord / close) so the
 * operator's monitor list reflects the new state without a manual refresh.
 *
 * Reported by Flávio 2026-05: after closing an attendance the row stayed
 * stale until F5. The mutation onSuccess only invalidated
 * `['patrol-actions']` and the local attendance-records, but didn't force
 * an active refetch — and never touched `['occurrences']` /
 * `['time-entries']` that the monitor's parallel cards also use.
 *
 * `refetchType: 'active'` forces every currently-mounted query under each
 * prefix to refetch immediately, instead of just marking them stale.
 */
export function invalidateAlerts(
  queryClient: QueryClient,
  options?: { patrolActionId?: string | null },
): void {
  const refetch = (queryKey: readonly unknown[]) =>
    queryClient.invalidateQueries({ queryKey, refetchType: 'active' });

  refetch(['patrol-actions']);
  refetch(['occurrences']);
  refetch(['time-entries']);
  if (options?.patrolActionId) {
    refetch(['attendance-records', options.patrolActionId]);
  } else {
    refetch(['attendance-records']);
  }
}
