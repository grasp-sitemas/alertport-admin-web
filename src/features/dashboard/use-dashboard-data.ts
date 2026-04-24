'use client';

import { useQuery } from '@tanstack/react-query';
import { alertsService } from '@/services/alerts.service';
import { equipmentService } from '@/services/equipment.service';
import { usersService } from '@/services/users.service';
import { useUserScope, applyUserScope } from '@/hooks/use-user-scope';

export interface DashboardRange {
  /** ISO date-time (inclusive) at the start of the analysis window. */
  startISO: string;
  /** ISO date-time (exclusive) at the end of the analysis window. */
  endISO: string;
}

/**
 * Optional hierarchy overrides applied on top of the session scope.
 * Only SUPER_ADMIN_MASTER can cross accounts in practice; other roles
 * have the override silently narrowed by the server's tenancy guards.
 */
export interface DashboardHierarchyOverride {
  account?: string;
  client?: string;
  site?: string;
}

/**
 * Dashboard KPIs + occurrences list. All filter endpoints are scoped to
 * the logged-in user's account / client / site hierarchy so the
 * frontend does not have to second-guess tenancy boundaries.
 *
 * Caller owns the date range, so operators can switch 7/30/90 day views
 * without the hook recomputing it on every render.
 */
export function useDashboardData(
  range: DashboardRange,
  override: DashboardHierarchyOverride = {},
) {
  const scope = useUserScope();

  // Compose an effective scope so the dashboard honours an explicit
  // account/client/site pick from the filter panel. Session-level scope
  // still wins for non-SAM roles because the server enforces tenancy
  // regardless of what we send; we just let the user narrow further.
  const effectiveScope = {
    accountId: override.account || scope.accountId,
    clientId: override.client || scope.clientId,
    siteId: override.site || scope.siteId,
  };

  const occurrences = useQuery({
    queryKey: [
      'dashboard',
      'occurrences',
      range.startISO,
      range.endISO,
      effectiveScope.accountId ?? '',
      effectiveScope.clientId ?? '',
      effectiveScope.siteId ?? '',
    ],
    queryFn: () =>
      alertsService.filterOccurrences(
        applyUserScope(
          {
            skip: 1,
            limit: 500,
            startDate: range.startISO,
            endDate: range.endISO,
          },
          effectiveScope,
        ),
      ),
  });

  const equipmentCount = useQuery({
    queryKey: [
      'dashboard',
      'equipment-count',
      effectiveScope.accountId ?? '',
      effectiveScope.clientId ?? '',
      effectiveScope.siteId ?? '',
    ],
    queryFn: () =>
      equipmentService.filter(
        applyUserScope({ skip: 1, limit: 1, status: 'ACTIVE' }, effectiveScope),
      ),
  });

  const collaboratorCount = useQuery({
    queryKey: [
      'dashboard',
      'collaborator-count',
      effectiveScope.accountId ?? '',
      effectiveScope.clientId ?? '',
      effectiveScope.siteId ?? '',
    ],
    queryFn: () =>
      usersService.filterCollaborators(
        applyUserScope({ skip: 1, limit: 1, status: 'ACTIVE' }, effectiveScope),
      ),
  });

  return {
    occurrences,
    equipmentCount,
    collaboratorCount,
    isLoading:
      occurrences.isLoading || equipmentCount.isLoading || collaboratorCount.isLoading,
  };
}
