'use client';

import { useQuery } from '@tanstack/react-query';
import { alertsService } from '@/services/alerts.service';
import { equipmentService } from '@/services/equipment.service';
import { usersService } from '@/services/users.service';

export function useDashboardData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const occurrences = useQuery({
    queryKey: ['dashboard', 'occurrences', weekAgo.toISOString(), today.toISOString()],
    queryFn: () =>
      alertsService.filterOccurrences({
        skip: 1,
        limit: 500,
        startDate: weekAgo.toISOString(),
        endDate: new Date().toISOString(),
      }),
  });

  const equipmentCount = useQuery({
    queryKey: ['dashboard', 'equipment-count'],
    queryFn: () => equipmentService.filter({ skip: 1, limit: 1, status: 'ACTIVE' }),
  });

  const collaboratorCount = useQuery({
    queryKey: ['dashboard', 'collaborator-count'],
    queryFn: () => usersService.filterCollaborators({ skip: 1, limit: 1, status: 'ACTIVE' }),
  });

  return {
    occurrences,
    equipmentCount,
    collaboratorCount,
    isLoading:
      occurrences.isLoading || equipmentCount.isLoading || collaboratorCount.isLoading,
  };
}
