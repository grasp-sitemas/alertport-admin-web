'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useSosReport } from '@/features/reports/use-reports';
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
import {
  defaultReportRange,
  validateReportFilter,
} from '@/features/reports/report-filter-validator';
import { toIsoEndOfDay, toIsoStartOfDay } from '@/lib/date-range';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';
import type { ReportFilterParams, SosRow } from '@/types/reports';
import type { ExportPayload } from '@/features/reports/report-export';

/**
 * Alertas de SOS - listagem completa de acionamentos com tempo de
 * resposta e atendimento. Backend source: `patrol-actions` com
 * `type='SOS_ALERT'` e `source='ALERTPORT'`.
 */
export default function SosReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <SosPageBody />
      </ModuleGuard>
    </RoleGuard>
  );
}

function SosPageBody() {
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const showAccountColumn = isSuperAdminMaster(userSubtype);

  const [filterValue, setFilterValue] = useState<ReportFilterValue>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { hierarchy: {}, startDate, endDate };
  });
  const [appliedFilter, setAppliedFilter] = useState<ReportFilterParams | null>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { startDate: toIsoStartOfDay(startDate), endDate: toIsoEndOfDay(endDate) };
  });

  const query = useSosReport(appliedFilter);

  const apply = useCallback(() => {
    if (!validateReportFilter(filterValue).ok) return;
    setAppliedFilter({
      // RP5: widen to full local-day ISO bounds — see src/lib/date-range.ts.
      startDate: toIsoStartOfDay(filterValue.startDate),
      endDate: toIsoEndOfDay(filterValue.endDate),
      ...(filterValue.hierarchy.account ? { account: filterValue.hierarchy.account } : {}),
      ...(filterValue.hierarchy.client ? { client: filterValue.hierarchy.client } : {}),
      ...(filterValue.hierarchy.site ? { site: filterValue.hierarchy.site } : {}),
      ...(filterValue.equipment ? { equipment: filterValue.equipment } : {}),
    });
    void query.refetch();
  }, [filterValue, query]);

  const clear = useCallback(() => {
    const { startDate, endDate } = defaultReportRange();
    setFilterValue({ hierarchy: {}, startDate, endDate });
    setAppliedFilter({
      startDate: toIsoStartOfDay(startDate),
      endDate: toIsoEndOfDay(endDate),
    });
  }, []);
  const data = query.data;
  const summary = data?.summary;
  // RP4: default chronological sort - oldest first by trigger date.
  const rows = useMemo<SosRow[]>(() => {
    const list = data?.results ?? [];
    return [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);
  const pagination = useClientPagination(rows, { initialPageSize: 20 });

  // Column order (user-facing requirement):
  //   1. Date, 2. Conta (SAM-only), 3. Cliente, 4. Posto,
  //   5. Vigilante, 6. Operador, 7. Status, 8. T. Resposta, 9. T. Resolução.
  const columns = useMemo<Column<SosRow>[]>(
    () => [
      {
        key: 'date',
        headerKey: 'reports.sos.date',
        render: (r) => new Date(r.date).toLocaleString(),
      },
      ...(showAccountColumn
        ? ([
            {
              key: 'account',
              headerKey: 'common.account',
              render: (r: SosRow) => r.account?.name ?? '-',
            },
          ] as Column<SosRow>[])
        : []),
      {
        key: 'client',
        headerKey: 'common.client',
        render: (r) => r.client?.name ?? '-',
      },
      {
        key: 'site',
        headerKey: 'common.site',
        render: (r) => r.site?.name ?? '-',
      },
      {
        key: 'vigilant',
        headerKey: 'reports.sos.vigilant',
        render: (r) =>
          r.vigilant
            ? `${r.vigilant.firstName ?? ''} ${r.vigilant.lastName ?? ''}`.trim() || '-'
            : '-',
      },
      {
        key: 'operator',
        headerKey: 'reports.sos.operator',
        render: (r) =>
          r.operator
            ? `${r.operator.firstName ?? ''} ${r.operator.lastName ?? ''}`.trim() || '-'
            : '-',
      },
      {
        key: 'attendanceStatus',
        headerKey: 'reports.sos.attendanceStatus',
        render: (r) => <AttendanceStatusBadge row={r} />,
      },
      {
        key: 'responseTime',
        headerKey: 'reports.sos.responseTime',
        render: (r) => formatSeconds(r.responseTimeSec),
      },
      {
        key: 'resolutionTime',
        headerKey: 'reports.sos.resolutionTime',
        render: (r) => formatSeconds(r.resolutionTimeSec),
      },
    ],
    [showAccountColumn],
  );

  const getExportPayload = useCallback((): ExportPayload<SosRow> | null => {
    if (!summary || rows.length === 0) return null;
    return {
      fileName: 'alertas_sos',
      title: t('reports.sos.title'),
      subtitle: `${filterValue.startDate} - ${filterValue.endDate}`,
      generatedAt: data?.generatedAt || new Date().toISOString(),
      kpis: [
        { label: t('reports.sos.kpi.total'), value: formatNumber(summary.total) },
        { label: t('reports.sos.kpi.attended'), value: formatNumber(summary.attended) },
        { label: t('reports.sos.kpi.unattended'), value: formatNumber(summary.unattended) },
        { label: t('reports.sos.kpi.attendedRate'), value: formatPercent(summary.attendedRate) },
        {
          label: t('reports.sos.kpi.avgResponseTime'),
          value: formatSeconds(summary.avgResponseTimeSec),
        },
      ],
      columns: [
        { header: t('reports.sos.date'), value: (r) => new Date(r.date) },
        ...(showAccountColumn
          ? [{ header: t('common.account'), value: (r: SosRow) => r.account?.name ?? '' }]
          : []),
        { header: t('common.client'), value: (r) => r.client?.name ?? '' },
        { header: t('common.site'), value: (r) => r.site?.name ?? '' },
        {
          header: t('reports.sos.vigilant'),
          value: (r) =>
            r.vigilant ? `${r.vigilant.firstName ?? ''} ${r.vigilant.lastName ?? ''}`.trim() : '',
        },
        {
          header: t('reports.sos.operator'),
          value: (r) =>
            r.operator ? `${r.operator.firstName ?? ''} ${r.operator.lastName ?? ''}`.trim() : '',
        },
        {
          header: t('reports.sos.attendanceStatus'),
          value: (r) =>
            r.attendance?.status ?? (r.attendance?.isAttendance ? 'IN_PROGRESS' : 'UNATTENDED'),
        },
        {
          header: t('reports.sos.responseTime'),
          value: (r) => (r.responseTimeSec != null ? Math.round(r.responseTimeSec) : ''),
        },
        {
          header: t('reports.sos.resolutionTime'),
          value: (r) => (r.resolutionTimeSec != null ? Math.round(r.resolutionTimeSec) : ''),
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
      title={t('reports.sos.title')}
      description={t('reports.sos.description')}
      filters={
        <ReportFilterPanel
          value={filterValue}
          onChange={setFilterValue}
          onApply={apply}
          onClear={clear}
          isLoading={query.isLoading}
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
        <ReportKpiGrid cols={5}>
          <ReportKpiTile
            label={t('reports.sos.kpi.total')}
            value={formatNumber(summary.total)}
            icon={AlertTriangle}
            accent="danger"
          />
          <ReportKpiTile
            label={t('reports.sos.kpi.attended')}
            value={formatNumber(summary.attended)}
            icon={CheckCircle2}
            accent="success"
          />
          <ReportKpiTile
            label={t('reports.sos.kpi.unattended')}
            value={formatNumber(summary.unattended)}
            icon={XCircle}
            accent="danger"
          />
          <ReportKpiTile
            label={t('reports.sos.kpi.attendedRate')}
            value={formatPercent(summary.attendedRate)}
            accent="success"
          />
          <ReportKpiTile
            label={t('reports.sos.kpi.avgResponseTime')}
            value={formatSeconds(summary.avgResponseTimeSec)}
            icon={Clock}
            accent="info"
          />
        </ReportKpiGrid>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.sos.tableTitle')}</CardTitle>
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

function AttendanceStatusBadge({ row }: { row: SosRow }) {
  const t = useTranslations();
  const status = row.attendance?.status;
  if (status === 'CLOSED') {
    return <Badge variant="success">{t('reports.sos.statusValue.CLOSED')}</Badge>;
  }
  if (row.attendance?.isAttendance) {
    return <Badge variant="warning">{t('reports.sos.statusValue.IN_PROGRESS')}</Badge>;
  }
  return <Badge variant="danger">{t('reports.sos.statusValue.UNATTENDED')}</Badge>;
}
