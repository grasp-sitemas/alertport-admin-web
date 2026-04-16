'use client';

import { useQuery } from '@tanstack/react-query';
import { alertsService } from '@/services/alerts.service';
import { equipmentService } from '@/services/equipment.service';
import { usersService } from '@/services/users.service';
import { useUserScope, applyUserScope } from '@/hooks/use-user-scope';

/**
 * Dashboard KPIs — all filter endpoints are scoped to the logged-in user's
 * account / client / site hierarchy, matching the legacy shieldgo behaviour.
 */
export function useDashboardData() {
  const scope = useUserScope();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const occurrences = useQuery({
    queryKey: [
      'dashboard',
      'occurrences',
      weekAgo.toISOString(),
      today.toISOString(),
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
            startDate: weekAgo.toISOString(),
            endDate: new Date().toISOString(),
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
