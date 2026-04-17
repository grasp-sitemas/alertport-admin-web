import type { QueryClient } from '@tanstack/react-query';

/**
 * Which entity kind was just mutated. Every mutation in the app that creates,
 * updates, archives or deletes one of these should call
 * `invalidateHierarchyAfter(queryClient, kind)` from its `onSuccess`/`onError`
 * handler so the cascading lookups stay in sync.
 */
export type MutatedKind = 'account' | 'client' | 'site' | 'equipment' | 'user';

/**
 * Invalidate every React Query cache that depends — directly or transitively —
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
