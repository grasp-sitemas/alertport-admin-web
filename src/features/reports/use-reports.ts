'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';
import type { ReportFilterParams } from '@/types/reports';
import { validateReportFilter } from './report-filter-validator';

/**
 * Shared React Query hooks for the 4 AlertPort reports.
 *
 * - Guarded by a client-side `validateReportFilter` check so an
 *   invalid filter never triggers a network request.
 * - 30s staleTime: reports aren't real-time dashboards; clients
 *   scroll, filter, come back — caching a minute's-worth avoids
 *   unnecessary Heroku round-trips.
 * - retry: 1 — backend returns 400 for most user errors; auto-retry
 *   would only amplify bad filters. A single retry covers transient
 *   network hiccups without flooding the API.
 */

const STALE_MS = 30_000;

function canRun(filter: ReportFilterParams | null): boolean {
  if (!filter) return false;
  return validateReportFilter(filter).ok;
}

export function useAdherenceReport(filter: ReportFilterParams | null) {
  return useQuery({
    queryKey: ['reports', 'adherence', filter],
    queryFn: () => {
      if (!filter) throw new Error('filter.required');
      return reportsService.adherence(filter);
    },
    enabled: canRun(filter),
    staleTime: STALE_MS,
    retry: 1,
  });
}

export function useAttendanceReport(filter: ReportFilterParams | null) {
  return useQuery({
    queryKey: ['reports', 'attendance', filter],
    queryFn: () => {
      if (!filter) throw new Error('filter.required');
      return reportsService.attendance(filter);
    },
    enabled: canRun(filter),
    staleTime: STALE_MS,
    retry: 1,
  });
}

export function useSosReport(filter: ReportFilterParams | null) {
  return useQuery({
    queryKey: ['reports', 'sos', filter],
    queryFn: () => {
      if (!filter) throw new Error('filter.required');
      return reportsService.sos(filter);
    },
    enabled: canRun(filter),
    staleTime: STALE_MS,
    retry: 1,
  });
}

export function useSlaReport(
  filter: (ReportFilterParams & { slaThresholdSec?: number }) | null,
) {
  return useQuery({
    queryKey: ['reports', 'sla', filter],
    queryFn: () => {
      if (!filter) throw new Error('filter.required');
      return reportsService.sla(filter);
    },
    enabled: canRun(filter),
    staleTime: STALE_MS,
    retry: 1,
  });
}
