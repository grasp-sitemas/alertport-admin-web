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
 * Dashboard KPIs + occurrences list. All filter endpoints are scoped to
 * the logged-in user's account / client / site hierarchy so the
 * frontend does not have to second-guess tenancy boundaries.
 *
 * Caller owns the date range, so operators can switch 7/30/90 day views
 * without the hook recomputing it on every render.
 */
export function useDashboardData(range: DashboardRange) {
  const scope = useUserScope();

  const occurrences = useQuery({
    queryKey: [
      'dashboard',
      'occurrences',
      range.startISO,
      range.endISO,
      scope.accountId ?? '',
      scope.clientId ?? '',
      scope.siteId ?? '',
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
          scope,
        ),
      ),
  });

  const equipmentCount = useQuery({
    queryKey: [
      'dashboard',
      'equipment-count',
      scope.accountId ?? '',
      scope.clientId ?? '',
      scope.siteId ?? '',
    ],
    queryFn: () =>
      equipmentService.filter(
        applyUserScope({ skip: 1, limit: 1, status: 'ACTIVE' }, scope),
      ),
  });

  const collaboratorCount = useQuery({
    queryKey: [
      'dashboard',
      'collaborator-count',
      scope.accountId ?? '',
      scope.clientId ?? '',
      scope.siteId ?? '',
    ],
    queryFn: () =>
      usersService.filterCollaborators(
        applyUserScope({ skip: 1, limit: 1, status: 'ACTIVE' }, scope),
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
