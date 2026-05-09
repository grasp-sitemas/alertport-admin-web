'use client';

import { useQuery } from '@tanstack/react-query';
import { alertsService } from '@/services/alerts.service';
import { equipmentService } from '@/services/equipment.service';
import { usersService } from '@/services/users.service';
import { useUserScope, applyUserScope } from '@/hooks/use-user-scope';
import type { Equipment } from '@/types/api';

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
 * Tipos de equipamento que devem ser EXCLUÍDOS do count de "Dispositivos
 * cadastrados". O backend ainda mistura bastões de ronda e patrol staff
 * dentro da coleção `equipments`. Como `Equipment.type` é apenas um id,
 * esta heurística inspeciona campos textuais (`code`, `brand`, `name`,
 * `model`) — a importação Patrol/GWronda costuma colocar "ronda"/"patrol"
 * nesses campos.
 *
 * TODO(backend): expor `equipmentType.category` ou `Equipment.kind` para
 * eliminar a heurística client-side. Ver feedback do Flavio (D1).
 */
const PATROL_DEVICE_PATTERN = /ronda|patrol|bast(a|ã)o/i;

/** Janela de "atividade recente" para o keep-alive de devices legados/mobile. */
const ACTIVE_DEVICE_WINDOW_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

const DEVICE_TIMESTAMP_FIELDS: Array<keyof Equipment> = [
  'updateDate',
  'updatedDate',
  'createDate',
  'createdDate',
];

function isPatrolDevice(eq: Equipment): boolean {
  const haystack = [eq.code, eq.brand, eq.name, eq.model]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ');
  return PATROL_DEVICE_PATTERN.test(haystack);
}

function getLatestTimestamp(eq: Equipment): number | null {
  for (const field of DEVICE_TIMESTAMP_FIELDS) {
    const raw = eq[field];
    if (typeof raw === 'string' && raw.length > 0) {
      const t = new Date(raw).getTime();
      if (!Number.isNaN(t)) return t;
    }
  }
  return null;
}

/**
 * Dashboard KPIs + occurrences list. All filter endpoints are scoped to
 * the logged-in user's account / client / site hierarchy so the
 * frontend does not have to second-guess tenancy boundaries.
 *
 * Caller owns the date range, so operators can switch 7/30/90 day views
 * without the hook recomputing it on every render.
 */
export function useDashboardData(range: DashboardRange, override: DashboardHierarchyOverride = {}) {
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

  /**
   * D1 + D2 (feedback Flavio): puxa a lista real de equipments para
   * (a) excluir bastões de ronda/patrol do count "Dispositivos cadastrados"
   *     e (b) derivar o contador de "Dispositivos Ativos" via keep-alive.
   *
   * Limit alto (até 1000) cobre o universo atual do AlertPort. Para tenants
   * maiores, mover esta agregação para um endpoint dedicado no backend.
   */
  const equipmentList = useQuery({
    queryKey: [
      'dashboard',
      'equipment-list',
      effectiveScope.accountId ?? '',
      effectiveScope.clientId ?? '',
      effectiveScope.siteId ?? '',
    ],
    queryFn: () =>
      equipmentService.filter(
        applyUserScope({ skip: 1, limit: 1000, status: 'ACTIVE' }, effectiveScope),
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

  // Derived AlertPort device counters. Calculados aqui para deixar a página declarativa.
  const allEquipments = equipmentList.data?.results ?? [];
  const nonPatrolEquipments = allEquipments.filter((e) => !isPatrolDevice(e));
  const registeredDevicesCount = nonPatrolEquipments.length;

  const cutoff = Date.now() - ACTIVE_DEVICE_WINDOW_HOURS * HOUR_MS;
  const activeDevicesCount = nonPatrolEquipments.filter((e) => {
    const t = getLatestTimestamp(e);
    return t !== null && t >= cutoff;
  }).length;

  return {
    occurrences,
    equipmentCount,
    equipmentList,
    collaboratorCount,
    /** D1: count após excluir bastões de patrol/ronda. */
    registeredDevicesCount,
    /** D2: best-effort active devices via timestamp de update como keep-alive. */
    activeDevicesCount,
    /** Quando true, o cálculo de activeDevices é uma estimativa (ver tooltip). */
    activeDevicesIsEstimate: true,
    isLoading:
      occurrences.isLoading ||
      equipmentCount.isLoading ||
      equipmentList.isLoading ||
      collaboratorCount.isLoading,
  };
}
