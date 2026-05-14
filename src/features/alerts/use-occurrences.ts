'use client';

import { useQuery } from '@tanstack/react-query';
import { alertsService } from '@/services/alerts.service';
import type { FilterParams } from '@/types/api';

export function useOccurrences(params: FilterParams, enabled = true) {
  return useQuery({
    queryKey: ['occurrences', params],
    queryFn: () => alertsService.filterOccurrences(params),
    enabled,
  });
}

export function useTimeEntries(params: FilterParams, enabled = true) {
  return useQuery({
    queryKey: ['time-entries', params],
    queryFn: () => alertsService.filterTimeEntries(params),
    enabled,
  });
}

export function useAlertSchedules(params: FilterParams, enabled = true) {
  return useQuery({
    queryKey: ['alert-schedules', params],
    queryFn: () => alertsService.filterSchedules(params),
    enabled,
  });
}

export function usePatrolActions(params: FilterParams, enabled = true) {
  return useQuery({
    queryKey: ['patrol-actions', params],
    queryFn: () => alertsService.filterPatrolActions(params),
    enabled,
  });
}

/**
 * AlertPort /monitor — alta-volumetria. Usa endpoint dedicado
 * (`/filter/alertport/monitor/v1/`) com pipeline DB otimizado. Mesma
 * shape de FilterParams.
 */
export function usePatrolActionsForMonitor(params: FilterParams, enabled = true) {
  return useQuery({
    queryKey: ['patrol-actions-monitor', params],
    queryFn: () => alertsService.filterPatrolActionsForMonitor(params),
    enabled,
  });
}

export function useAttendanceTypes() {
  return useQuery({
    queryKey: ['attendance-types'],
    queryFn: () => alertsService.getAttendanceTypes(),
    staleTime: 10 * 60 * 1000,
  });
}
