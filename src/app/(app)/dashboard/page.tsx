'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bell,
  CheckCircle2,
  Clock,
  Cpu,
  MapPin,
  PieChart as PieIcon,
  Smartphone,
  TrendingUp,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/features/dashboard/kpi-card';
import { useDashboardData, type DashboardRange } from '@/features/dashboard/use-dashboard-data';
import {
  HierarchyFilters,
  type HierarchyFiltersValue,
} from '@/components/shared/hierarchy-filters';
import { Search, X } from 'lucide-react';
import {
  EventsTrendChart,
  StatusDonut,
  TopSitesBars,
  type RankedSite,
  type StatusSlice,
  type TrendPoint,
} from '@/features/dashboard/dashboard-charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AlertOccurrence } from '@/types/api';
import { OccurrenceStatusBadge } from '@/components/shared/status-badge';

/** Ranges the operator can pick. Kept small - wide ranges saturate the
 *  API (limit=500) and the dashboard has a dedicated report page for
 *  deeper drill-downs.
 */
const RANGE_PRESETS = [
  { id: 7, labelKey: 'dashboard.range7' },
  { id: 30, labelKey: 'dashboard.range30' },
  { id: 90, labelKey: 'dashboard.range90' },
] as const;

type RangeId = (typeof RANGE_PRESETS)[number]['id'];

function buildRange(days: RangeId): DashboardRange {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export default function DashboardPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const [rangeDays, setRangeDays] = useState<RangeId>(7);
  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});
  const range = useMemo(() => buildRange(rangeDays), [rangeDays]);
  const {
    occurrences,
    equipmentList,
    collaboratorCount,
    registeredDevicesCount,
    activeDevicesCount,
    activeDevicesIsEstimate,
  } = useDashboardData(range, activeHierarchy);
  const occurrencesLoading = occurrences.isLoading;
  const equipmentLoading = equipmentList.isLoading;

  /**
   * D2 (feedback Flavio): mantemos o card "Colaboradores Ativos" oculto
   * via flag (NÃO deletado) para regressão futura. Flip para true se
   * precisar do card de volta sem novo deploy.
   */
  const SHOW_LEGACY_COLLABORATORS_CARD = false;

  const applyFilters = () => setActiveHierarchy(hierarchy);
  const clearFilters = () => {
    setHierarchy({});
    setActiveHierarchy({});
    setRangeDays(7);
  };
  const hasFilterChanges =
    hierarchy.account !== activeHierarchy.account ||
    hierarchy.client !== activeHierarchy.client ||
    hierarchy.site !== activeHierarchy.site;

  const occurrenceList = occurrences.data?.results || [];
  const pendingCount = occurrenceList.filter((o) => o.status === 'PENDING').length;
  const respondedCount = occurrenceList.filter((o) => o.status === 'RESPONDED').length;
  const missedCount = occurrenceList.filter((o) => o.status === 'MISSED').length;
  const totalCount = occurrences.data?.totalCount ?? occurrenceList.length;

  // Time-series data. buildTrend always returns one point per day in the
  // selected window so gaps render as zero instead of collapsing the axis.
  const trendData = useMemo<TrendPoint[]>(
    () => buildTrend(occurrenceList, rangeDays),
    [occurrenceList, rangeDays],
  );

  // Status donut. The order keeps the "good" state (responded) first so
  // the donut reads clockwise from success → pending → missed.
  const statusSlices = useMemo<StatusSlice[]>(
    () => [
      { name: t('alerts.responded'), value: respondedCount, color: 'rgb(16,185,129)' },
      { name: t('alerts.pending'), value: pendingCount, color: 'rgb(245,158,11)' },
      { name: t('alerts.missed'), value: missedCount, color: 'rgb(239,68,68)' },
    ],
    [t, respondedCount, pendingCount, missedCount],
  );

  const topSites = useMemo<RankedSite[]>(() => rankSites(occurrenceList, 10), [occurrenceList]);

  // D4: 20 linhas, mais recente primeiro, dedupe por site.
  const recentActivity = useMemo<AlertOccurrence[]>(
    () => buildRecentActivity(occurrenceList, 20),
    [occurrenceList],
  );

  const responseRate = totalCount > 0 ? Math.round((respondedCount / totalCount) * 100) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${t('auth.welcomeBack')}, ${user?.firstName || ''}`}
        description={t('dashboard.welcome')}
      />

      <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3">
        {/* Hierarchy row — each SAM/ADMIN select sits in its own column so
            the three fit on one line on md+ screens, matching the shared
            FilterPanel grid used elsewhere. */}
        <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
          <HierarchyFilters value={hierarchy} onChange={setHierarchy} compact />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label className="text-text-secondary mb-1 block text-[10px] font-semibold tracking-wider uppercase">
              {t('dashboard.rangeLabel')}
            </label>
            <div className="inline-flex rounded-lg border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-1">
              {RANGE_PRESETS.map((preset) => {
                const active = preset.id === rangeDays;
                return (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant={active ? 'secondary' : 'ghost'}
                    onClick={() => setRangeDays(preset.id)}
                    className={active ? '' : 'text-text-muted'}
                  >
                    {t(preset.labelKey)}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
              {t('common.clearFilters')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={applyFilters}
              disabled={!hasFilterChanges && !occurrencesLoading}
            >
              <Search className="h-4 w-4" />
              {t('common.search')}
            </Button>
          </div>
        </div>
      </div>

      <div
        data-tour="dashboard-kpis"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          title={t('dashboard.totalAlerts')}
          value={totalCount}
          icon={Bell}
          accent="brand"
          isLoading={occurrencesLoading}
          trend={
            responseRate !== null ? `${responseRate}% ${t('dashboard.responseRate')}` : undefined
          }
        />
        <KpiCard
          title={t('dashboard.pendingAlerts')}
          value={pendingCount}
          icon={Clock}
          accent="warning"
          isLoading={occurrencesLoading}
        />
        <KpiCard
          title={t('dashboard.respondedAlerts')}
          value={respondedCount}
          icon={CheckCircle2}
          accent="success"
          isLoading={occurrencesLoading}
        />
        <KpiCard
          title={t('dashboard.missedAlerts')}
          value={missedCount}
          icon={XCircle}
          accent="danger"
          isLoading={occurrencesLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* D1: renomeado de "Equipamentos ativos" para "Dispositivos
            cadastrados", excluindo bastões de ronda/patrol via heurística
            client-side (ver use-dashboard-data.ts). */}
        <KpiCard
          title={t('dashboard.registeredDevices')}
          value={registeredDevicesCount}
          icon={Cpu}
          accent="info"
          isLoading={equipmentLoading}
        />
        {/* D2: novo card "Dispositivos Ativos". Estimativa via última
            atualização (keep-alive). Sufixo "*" + tooltip via title. */}
        <KpiCard
          title={
            activeDevicesIsEstimate
              ? `${t('dashboard.activeDevices')} *`
              : t('dashboard.activeDevices')
          }
          value={activeDevicesCount}
          icon={Smartphone}
          accent="success"
          isLoading={equipmentLoading}
          trend={activeDevicesIsEstimate ? t('dashboard.activeDevicesEstimateHint') : undefined}
        />
        {/* D2: card legado preservado atrás de flag (default OFF) — não
            deletado para permitir regressão sem novo deploy. */}
        {SHOW_LEGACY_COLLABORATORS_CARD ? (
          <KpiCard
            title={t('dashboard.activeCollaborators')}
            value={collaboratorCount.data?.totalCount ?? 0}
            icon={UserCheck}
            accent="brand"
            isLoading={collaboratorCount.isLoading}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="text-brand-500 h-4 w-4" />
              {t('dashboard.alertsByDay')}
            </CardTitle>
            <CardDescription>{t('dashboard.trendDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {occurrencesLoading ? (
              <div className="h-[240px] animate-pulse rounded-lg bg-white/[0.02]" />
            ) : (
              <EventsTrendChart data={trendData} formatDay={formatDayShort} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieIcon className="text-brand-500 h-4 w-4" />
              {t('dashboard.statusBreakdown')}
            </CardTitle>
            <CardDescription>{t('dashboard.statusBreakdownDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {occurrencesLoading ? (
              <div className="h-[240px] animate-pulse rounded-lg bg-white/[0.02]" />
            ) : (
              <>
                <StatusDonut data={statusSlices} />
                <ul className="mt-3 space-y-1.5 text-xs">
                  {statusSlices.map((slice) => (
                    <li key={slice.name} className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary inline-flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: slice.color }}
                        />
                        {slice.name}
                      </span>
                      <span className="font-semibold text-white">{slice.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="text-brand-500 h-4 w-4" />
              {t('dashboard.topSites')}
            </CardTitle>
            <CardDescription>{t('dashboard.topSitesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {occurrencesLoading ? (
              <div className="h-[240px] animate-pulse rounded-lg bg-white/[0.02]" />
            ) : (
              <TopSitesBars
                data={topSites}
                stacked
                labels={{
                  responded: t('alerts.responded'),
                  pending: t('alerts.pending'),
                  missed: t('alerts.missed'),
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {occurrencesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.02]" />
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <p className="text-text-muted py-8 text-center text-sm">{t('common.noData')}</p>
              ) : (
                recentActivity.map((occ) => (
                  <div
                    key={occ._id}
                    className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {typeof occ.site === 'object' ? occ.site?.name : t('common.site')}
                      </p>
                      <p className="text-text-muted text-xs">{safeDateString(occ.scheduledAt)}</p>
                    </div>
                    <OccurrenceStatusBadge status={occ.status} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function safeDateString(value: unknown): string {
  if (!value) return '-';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
}

function buildTrend(list: AlertOccurrence[], days: number): TrendPoint[] {
  const bucket: Record<string, number> = {};
  for (const occ of list) {
    const raw = occ.scheduledAt ?? occ.createdDate;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    bucket[key] = (bucket[key] ?? 0) + 1;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({ day: key, count: bucket[key] ?? 0 });
  }
  return points;
}

function rankSites(list: AlertOccurrence[], limit: number): RankedSite[] {
  // D3 (Flavio): além do total, somamos o breakdown por status para a
  // barra empilhada (verde / laranja / vermelho).
  type Bucket = { count: number; responded: number; pending: number; missed: number };
  const counts = new Map<string, Bucket>();
  for (const occ of list) {
    const siteName = typeof occ.site === 'object' && occ.site?.name ? occ.site.name : undefined;
    if (!siteName) continue;
    const cur = counts.get(siteName) ?? { count: 0, responded: 0, pending: 0, missed: 0 };
    cur.count += 1;
    if (occ.status === 'RESPONDED') cur.responded += 1;
    else if (occ.status === 'PENDING') cur.pending += 1;
    else if (occ.status === 'MISSED') cur.missed += 1;
    counts.set(siteName, cur);
  }
  return [...counts.entries()]
    .map(([name, bucket]) => ({ name, ...bucket }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * D4 (Flavio): atividade recente — ordem desc, dedupe por site (último
 * evento de cada site), corte em 20 linhas.
 */
function buildRecentActivity(list: AlertOccurrence[], maxRows: number): AlertOccurrence[] {
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.scheduledAt ?? a.createdDate ?? 0).getTime();
    const tb = new Date(b.scheduledAt ?? b.createdDate ?? 0).getTime();
    return tb - ta;
  });
  const seen = new Map<string, AlertOccurrence>();
  for (const occ of sorted) {
    const siteId =
      typeof occ.site === 'object' && occ.site?._id
        ? occ.site._id
        : typeof occ.site === 'string'
          ? occ.site
          : null;
    if (!siteId) continue;
    if (!seen.has(siteId)) seen.set(siteId, occ);
    if (seen.size >= maxRows) break;
  }
  return [...seen.values()];
}

function formatDayShort(day: string): string {
  try {
    const d = new Date(day);
    if (Number.isNaN(d.getTime())) return day;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
  } catch {
    return day;
  }
}
