'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/data-table';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useVigilantAlertsReport } from '@/features/reports/use-reports';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { ReportFilterPanel, type ReportFilterValue } from '@/features/reports/report-filter-panel';
import { ReportExportButton } from '@/features/reports/report-export-button';
import { ReportPageLayout } from '@/features/reports/report-page-layout';
import {
  ReportKpiGrid,
  ReportKpiTile,
  formatNumber,
  formatPercent,
  formatSeconds,
} from '@/features/reports/report-kpi';
import { defaultReportRange, validateReportFilter } from '@/features/reports/report-filter-validator';
import { toIsoEndOfDay, toIsoStartOfDay } from '@/lib/date-range';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';
import type {
  ReportFilterParams,
  VigilantAlertsMode,
  VigilantAlertsRow,
} from '@/types/reports';
import type { ExportPayload } from '@/features/reports/report-export';

const MODE_OPTIONS: VigilantAlertsMode[] = ['all', 'responded', 'not_attended', 'pending'];

type AppliedFilter = ReportFilterParams & { mode?: VigilantAlertsMode };

/**
 * Atendimento do Vigilante - o que o vigia atendeu (RESPONDED) ou
 * deixou de atender (MISSED/EXPIRED) no campo. Fonte: alert-occurrences.
 * Relatório SEPARADO do de Aderência. O filtro de modo isola atendidos
 * x não atendidos x pendentes.
 */
export default function VigilantAlertsReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <VigilantAlertsPageBody />
      </ModuleGuard>
    </RoleGuard>
  );
}

function VigilantAlertsPageBody() {
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const showAccountColumn = isSuperAdminMaster(userSubtype);

  const [filterValue, setFilterValue] = useState<ReportFilterValue>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { hierarchy: {}, startDate, endDate };
  });
  const [mode, setMode] = useState<VigilantAlertsMode>('all');
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter | null>(() => {
    const { startDate, endDate } = defaultReportRange();
    return {
      startDate: toIsoStartOfDay(startDate),
      endDate: toIsoEndOfDay(endDate),
      mode: 'all',
    };
  });

  const query = useVigilantAlertsReport(appliedFilter);

  const apply = useCallback(() => {
    if (!validateReportFilter(filterValue).ok) return;
    setAppliedFilter({
      startDate: toIsoStartOfDay(filterValue.startDate),
      endDate: toIsoEndOfDay(filterValue.endDate),
      ...(filterValue.hierarchy.account ? { account: filterValue.hierarchy.account } : {}),
      ...(filterValue.hierarchy.client ? { client: filterValue.hierarchy.client } : {}),
      ...(filterValue.hierarchy.site ? { site: filterValue.hierarchy.site } : {}),
      mode,
    });
    void query.refetch();
  }, [filterValue, mode, query]);

  const clear = useCallback(() => {
    const { startDate, endDate } = defaultReportRange();
    setFilterValue({ hierarchy: {}, startDate, endDate });
    setMode('all');
    setAppliedFilter({
      startDate: toIsoStartOfDay(startDate),
      endDate: toIsoEndOfDay(endDate),
      mode: 'all',
    });
  }, []);

  const data = query.data;
  const summary = data?.summary;
  // Chronological reading order - oldest first by scheduled time.
  const rows = useMemo<VigilantAlertsRow[]>(() => {
    const list = data?.results ?? [];
    return [...list].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  }, [data]);
  const pagination = useClientPagination(rows, { initialPageSize: 20 });

  const columns = useMemo<Column<VigilantAlertsRow>[]>(
    () => [
      {
        key: 'date',
        headerKey: 'reports.vigilantAlerts.date',
        render: (r) => new Date(r.triggeredAt ?? r.scheduledAt).toLocaleString(),
      },
      ...(showAccountColumn
        ? ([
            {
              key: 'account',
              headerKey: 'common.account',
              render: (r: VigilantAlertsRow) => r.account?.name ?? '-',
            },
          ] as Column<VigilantAlertsRow>[])
        : []),
      { key: 'client', headerKey: 'common.client', render: (r) => r.client?.name ?? '-' },
      { key: 'site', headerKey: 'common.site', render: (r) => r.site?.name ?? '-' },
      {
        key: 'equipment',
        headerKey: 'reports.vigilantAlerts.equipment',
        render: (r) => r.equipment?.name || r.equipment?.uniqueId || '-',
      },
      {
        key: 'status',
        headerKey: 'reports.vigilantAlerts.status',
        render: (r) => <VigilantStatusBadge status={r.status} />,
      },
      {
        key: 'responseTime',
        headerKey: 'reports.vigilantAlerts.responseTime',
        render: (r) => formatSeconds(r.responseTimeSec),
      },
    ],
    [showAccountColumn],
  );

  const getExportPayload = useCallback((): ExportPayload<VigilantAlertsRow> | null => {
    if (!summary || rows.length === 0) return null;
    return {
      fileName: 'atendimento_vigilante',
      title: t('reports.vigilantAlerts.title'),
      subtitle: `${filterValue.startDate} - ${filterValue.endDate}`,
      generatedAt: data?.generatedAt || new Date().toISOString(),
      kpis: [
        { label: t('reports.vigilantAlerts.kpi.total'), value: formatNumber(summary.total) },
        { label: t('reports.vigilantAlerts.kpi.attended'), value: formatNumber(summary.attended) },
        {
          label: t('reports.vigilantAlerts.kpi.notAttended'),
          value: formatNumber(summary.notAttended),
        },
        {
          label: t('reports.vigilantAlerts.kpi.attendanceRate'),
          value: formatPercent(summary.attendanceRate),
        },
        {
          label: t('reports.vigilantAlerts.kpi.avgResponse'),
          value: formatSeconds(summary.avgResponseTimeSec),
        },
      ],
      columns: [
        {
          header: t('reports.vigilantAlerts.date'),
          value: (r) => new Date(r.triggeredAt ?? r.scheduledAt),
        },
        ...(showAccountColumn
          ? [{ header: t('common.account'), value: (r: VigilantAlertsRow) => r.account?.name ?? '' }]
          : []),
        { header: t('common.client'), value: (r) => r.client?.name ?? '' },
        { header: t('common.site'), value: (r) => r.site?.name ?? '' },
        {
          header: t('reports.vigilantAlerts.equipment'),
          value: (r) => r.equipment?.name || r.equipment?.uniqueId || '',
        },
        {
          header: t('reports.vigilantAlerts.status'),
          value: (r) => t(`reports.vigilantAlerts.statusValue.${r.status}`),
        },
        {
          header: t('reports.vigilantAlerts.responseTime'),
          value: (r) => (r.responseTimeSec != null ? Math.round(r.responseTimeSec) : ''),
        },
      ],
      rows,
    };
  }, [
    data?.generatedAt,
    filterValue.endDate,
    filterValue.startDate,
    rows,
    showAccountColumn,
    summary,
    t,
  ]);

  return (
    <ReportPageLayout
      title={t('reports.vigilantAlerts.title')}
      description={t('reports.vigilantAlerts.description')}
      filters={
        <ReportFilterPanel
          value={filterValue}
          onChange={setFilterValue}
          onApply={apply}
          onClear={clear}
          isLoading={query.isLoading}
          extras={
            <div>
              <label
                htmlFor="vigilant-alerts-mode"
                className="text-text-secondary mb-1 block text-[10px] font-semibold tracking-wider uppercase"
                title={t('reports.vigilantAlerts.modeHint')}
              >
                {t('reports.vigilantAlerts.modeLabel')}
              </label>
              <Select value={mode} onValueChange={(v) => setMode(v as VigilantAlertsMode)}>
                <SelectTrigger id="vigilant-alerts-mode" className="h-9 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`reports.vigilantAlerts.mode.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
      }
      actions={
        <ReportExportButton
          getPayload={getExportPayload}
          disabled={query.isLoading || rows.length === 0}
        />
      }
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      errorMessage={query.error instanceof Error ? query.error.message : undefined}
      isEmpty={!query.isLoading && !query.isError && (data?.totalCount ?? 0) === 0}
      footer={
        data ? (
          <p className="text-text-muted text-right text-xs">
            {t('reports.meta.generatedAt', {
              when: new Date(data.generatedAt).toLocaleString(),
              ms: data.durationMs,
            })}
          </p>
        ) : null
      }
    >
      {summary && (
        <ReportKpiGrid cols={4}>
          <ReportKpiTile
            label={t('reports.vigilantAlerts.kpi.total')}
            value={formatNumber(summary.total)}
            icon={ShieldCheck}
            accent="brand"
          />
          <ReportKpiTile
            label={t('reports.vigilantAlerts.kpi.attended')}
            value={formatNumber(summary.attended)}
            icon={CheckCircle2}
            accent="success"
          />
          <ReportKpiTile
            label={t('reports.vigilantAlerts.kpi.notAttended')}
            value={formatNumber(summary.notAttended)}
            hint={t('reports.vigilantAlerts.kpi.notAttendedHint', {
              missed: summary.missed,
              expired: summary.expired,
            })}
            icon={XCircle}
            accent="warning"
          />
          <ReportKpiTile
            label={t('reports.vigilantAlerts.kpi.attendanceRate')}
            value={formatPercent(summary.attendanceRate)}
            hint={t('reports.vigilantAlerts.kpi.avgResponseHint', {
              avg: formatSeconds(summary.avgResponseTimeSec),
            })}
            icon={Clock}
            accent="info"
          />
        </ReportKpiGrid>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.vigilantAlerts.tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={pagination.paged}
            isLoading={query.isLoading}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            getRowKey={(r) => r._id}
          />
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}

// RESPONDED → success, MISSED → danger, EXPIRED → warning, PENDING → info.
function VigilantStatusBadge({ status }: { status: VigilantAlertsRow['status'] }) {
  const t = useTranslations();
  const label = t(`reports.vigilantAlerts.statusValue.${status}`);
  if (status === 'RESPONDED') return <Badge variant="success">{label}</Badge>;
  if (status === 'MISSED') return <Badge variant="danger">{label}</Badge>;
  if (status === 'EXPIRED') return <Badge variant="warning">{label}</Badge>;
  return <Badge variant="info">{label}</Badge>;
}
