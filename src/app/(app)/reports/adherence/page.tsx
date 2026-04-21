'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Clock, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useAdherenceReport } from '@/features/reports/use-reports';
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
import type { AdherenceRow, ReportFilterParams } from '@/types/reports';
import type { ExportPayload } from '@/features/reports/report-export';

/**
 * Aderência de Ronda - the core KPI of AlertPort: did the vigia
 * press the button on every scheduled check? Rate = responded /
 * total. Backend source: `alert_occurrences`.
 */
export default function AdherenceReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER']}>
      <ModuleGuard moduleKey="REPORTS">
        <AdherencePageBody />
      </ModuleGuard>
    </RoleGuard>
  );
}

function AdherencePageBody() {
  const t = useTranslations();

  const [filterValue, setFilterValue] = useState<ReportFilterValue>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { hierarchy: {}, startDate, endDate };
  });
  const [appliedFilter, setAppliedFilter] = useState<ReportFilterParams | null>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { startDate, endDate };
  });

  const apply = useCallback(() => {
    const v = validateReportFilter(filterValue);
    if (!v.ok) return;
    setAppliedFilter({
      startDate: filterValue.startDate,
      endDate: filterValue.endDate,
      ...(filterValue.hierarchy.account ? { account: filterValue.hierarchy.account } : {}),
      ...(filterValue.hierarchy.client ? { client: filterValue.hierarchy.client } : {}),
      ...(filterValue.hierarchy.site ? { site: filterValue.hierarchy.site } : {}),
    });
  }, [filterValue]);

  const clear = useCallback(() => {
    const { startDate, endDate } = defaultReportRange();
    setFilterValue({ hierarchy: {}, startDate, endDate });
    setAppliedFilter({ startDate, endDate });
  }, []);

  const query = useAdherenceReport(appliedFilter);
  const data = query.data;
  const summary = data?.summary;
  const rows = useMemo<AdherenceRow[]>(() => data?.results ?? [], [data]);

  const columns = useMemo<Column<AdherenceRow>[]>(
    () => [
      {
        key: 'scheduledAt',
        headerKey: 'reports.adherence.scheduledAt',
        render: (r) => new Date(r.scheduledAt).toLocaleString(),
      },
      {
        key: 'status',
        headerKey: 'reports.adherence.status',
        render: (r) => <AdherenceStatusBadge status={r.status} />,
      },
      {
        key: 'respondedAt',
        headerKey: 'reports.adherence.respondedAt',
        render: (r) => (r.respondedAt ? new Date(r.respondedAt).toLocaleString() : '-'),
      },
      {
        key: 'responseTimeSec',
        headerKey: 'reports.adherence.responseTime',
        render: (r) => formatSeconds(r.responseTimeSec),
      },
      {
        key: 'site',
        headerKey: 'common.site',
        render: (r) => r.site?.name ?? '-',
      },
      {
        key: 'client',
        headerKey: 'common.client',
        render: (r) => r.client?.name ?? '-',
      },
    ],
    [],
  );

  const getExportPayload = useCallback((): ExportPayload<AdherenceRow> | null => {
    if (!summary || rows.length === 0) return null;
    return {
      fileName: 'aderencia_ronda',
      title: t('reports.adherence.title'),
      subtitle: `${filterValue.startDate} - ${filterValue.endDate}`,
      generatedAt: data?.generatedAt || new Date().toISOString(),
      kpis: [
        { label: t('reports.adherence.kpi.adherenceRate'), value: formatPercent(summary.adherenceRate) },
        { label: t('reports.adherence.kpi.attended'), value: formatNumber(summary.attended) },
        { label: t('reports.adherence.kpi.missed'), value: formatNumber(summary.missed) },
        { label: t('reports.adherence.kpi.total'), value: formatNumber(summary.total) },
        { label: t('reports.adherence.kpi.avgResponseTime'), value: formatSeconds(summary.avgResponseTimeSec) },
      ],
      columns: [
        { header: t('reports.adherence.scheduledAt'), value: (r) => new Date(r.scheduledAt) },
        { header: t('reports.adherence.status'), value: (r) => r.status },
        { header: t('reports.adherence.respondedAt'), value: (r) => (r.respondedAt ? new Date(r.respondedAt) : '') },
        { header: t('reports.adherence.responseTime'), value: (r) => (r.responseTimeSec != null ? Math.round(r.responseTimeSec) : '') },
        { header: t('common.site'), value: (r) => r.site?.name ?? '' },
        { header: t('common.client'), value: (r) => r.client?.name ?? '' },
      ],
      rows,
    };
  }, [data?.generatedAt, filterValue.endDate, filterValue.startDate, rows, summary, t]);

  return (
    <ReportPageLayout
      title={t('reports.adherence.title')}
      description={t('reports.adherence.description')}
      filters={
        <ReportFilterPanel
          value={filterValue}
          onChange={setFilterValue}
          onApply={apply}
          onClear={clear}
          isLoading={query.isLoading}
        />
      }
      actions={<ReportExportButton getPayload={getExportPayload} disabled={query.isLoading || rows.length === 0} />}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      errorMessage={query.error instanceof Error ? query.error.message : undefined}
      isEmpty={!query.isLoading && !query.isError && (data?.totalCount ?? 0) === 0}
      footer={
        data ? (
          <p className="text-xs text-text-muted text-right">
            {t('reports.meta.generatedAt', {
              when: new Date(data.generatedAt).toLocaleString(),
              ms: data.durationMs,
            })}
          </p>
        ) : null
      }
    >
      {summary && (
        <ReportKpiGrid cols={5}>
          <ReportKpiTile
            label={t('reports.adherence.kpi.adherenceRate')}
            value={formatPercent(summary.adherenceRate)}
            hint={t('reports.adherence.kpi.adherenceHint')}
            icon={Target}
            accent="success"
          />
          <ReportKpiTile
            label={t('reports.adherence.kpi.attended')}
            value={formatNumber(summary.attended)}
            icon={CheckCircle2}
            accent="success"
          />
          <ReportKpiTile
            label={t('reports.adherence.kpi.missed')}
            value={formatNumber(summary.missed)}
            icon={AlertTriangle}
            accent="danger"
          />
          <ReportKpiTile
            label={t('reports.adherence.kpi.total')}
            value={formatNumber(summary.total)}
            accent="brand"
          />
          <ReportKpiTile
            label={t('reports.adherence.kpi.avgResponseTime')}
            value={formatSeconds(summary.avgResponseTimeSec)}
            icon={Clock}
            accent="info"
          />
        </ReportKpiGrid>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.adherence.tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rows}
            isLoading={query.isLoading}
            page={1}
            pageSize={rows.length || 50}
            totalCount={data?.totalCount ?? 0}
            totalPages={1}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            getRowKey={(r) => r._id}
          />
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}

function AdherenceStatusBadge({ status }: { status: AdherenceRow['status'] }) {
  const t = useTranslations();
  const variant: 'success' | 'danger' | 'warning' | 'info' =
    status === 'RESPONDED' ? 'success' : status === 'MISSED' ? 'danger' : status === 'EXPIRED' ? 'warning' : 'info';
  return <Badge variant={variant}>{t(`reports.adherence.statusValue.${status}`)}</Badge>;
}
