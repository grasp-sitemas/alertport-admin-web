'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, LogIn, LogOut, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useAttendanceReport } from '@/features/reports/use-reports';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { ReportFilterPanel, type ReportFilterValue } from '@/features/reports/report-filter-panel';
import { ReportExportButton } from '@/features/reports/report-export-button';
import { ReportPageLayout } from '@/features/reports/report-page-layout';
import { ReportKpiGrid, ReportKpiTile, formatNumber } from '@/features/reports/report-kpi';
import {
  defaultReportRange,
  validateReportFilter,
} from '@/features/reports/report-filter-validator';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';
import type { AttendanceRow, ReportFilterParams } from '@/types/reports';
import type { ExportPayload } from '@/features/reports/report-export';

/**
 * Controle de Presença - consolidated view of every AlertPort
 * time-entry (CLOCK_IN/OUT, BREAK_START/END) in the window. Backend
 * source: `time-entries` with `source='ALERTPORT'`.
 */
export default function AttendanceReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <AttendancePageBody />
      </ModuleGuard>
    </RoleGuard>
  );
}

function AttendancePageBody() {
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const showAccountColumn = isSuperAdminMaster(userSubtype);

  const [filterValue, setFilterValue] = useState<ReportFilterValue>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { hierarchy: {}, startDate, endDate };
  });
  const [appliedFilter, setAppliedFilter] = useState<ReportFilterParams | null>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { startDate, endDate };
  });

  const query = useAttendanceReport(appliedFilter);

  const apply = useCallback(() => {
    if (!validateReportFilter(filterValue).ok) return;
    setAppliedFilter({
      startDate: filterValue.startDate,
      endDate: filterValue.endDate,
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
    setAppliedFilter({ startDate, endDate });
  }, []);
  const data = query.data;
  const summary = data?.summary;
  // RP4: default chronological sort - oldest first by createdAt.
  const rows = useMemo<AttendanceRow[]>(() => {
    const list = data?.results ?? [];
    return [...list].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [data]);
  const pagination = useClientPagination(rows, { initialPageSize: 20 });

  // Column order (user-facing requirement):
  //   1. Timestamp, 2. Tipo Evento, 3. Funcionário, 4. Conta (SAM-only),
  //   5. Cliente, 6. Posto, 7. Método.
  const columns = useMemo<Column<AttendanceRow>[]>(
    () => [
      {
        key: 'createdAt',
        headerKey: 'attendance.timestamp',
        render: (r) => new Date(r.createdAt).toLocaleString(),
      },
      {
        key: 'eventType',
        headerKey: 'attendance.eventType',
        render: (r) => <TimeEntryBadge type={r.eventType} />,
      },
      {
        key: 'user',
        headerKey: 'attendance.employee',
        render: (r) => {
          if (!r.user) return '-';
          const name = `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim();
          return name || '-';
        },
      },
      ...(showAccountColumn
        ? ([
            {
              key: 'account',
              headerKey: 'common.account',
              render: (r: AttendanceRow) => r.account?.name ?? '-',
            },
          ] as Column<AttendanceRow>[])
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
        key: 'method',
        headerKey: 'reports.attendance.method',
        render: (r) => r.method ?? '-',
      },
    ],
    [showAccountColumn],
  );

  const getExportPayload = useCallback((): ExportPayload<AttendanceRow> | null => {
    if (!summary || rows.length === 0) return null;
    return {
      fileName: 'controle_presenca',
      title: t('reports.attendance.title'),
      subtitle: `${filterValue.startDate} - ${filterValue.endDate}`,
      generatedAt: data?.generatedAt || new Date().toISOString(),
      kpis: [
        { label: t('reports.attendance.kpi.total'), value: formatNumber(summary.total) },
        { label: t('reports.attendance.kpi.clockIns'), value: formatNumber(summary.clockIns) },
        { label: t('reports.attendance.kpi.clockOuts'), value: formatNumber(summary.clockOuts) },
        {
          label: t('reports.attendance.kpi.uniqueUsers'),
          value: formatNumber(summary.uniqueUsers),
        },
      ],
      columns: [
        { header: t('attendance.timestamp'), value: (r) => new Date(r.createdAt) },
        { header: t('attendance.eventType'), value: (r) => r.eventType },
        {
          header: t('attendance.employee'),
          value: (r) => (r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() : ''),
        },
        ...(showAccountColumn
          ? [{ header: t('common.account'), value: (r: AttendanceRow) => r.account?.name ?? '' }]
          : []),
        { header: t('common.client'), value: (r: AttendanceRow) => r.client?.name ?? '' },
        { header: t('common.site'), value: (r) => r.site?.name ?? '' },
        { header: t('reports.attendance.method'), value: (r) => r.method ?? '' },
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
      title={t('reports.attendance.title')}
      description={t('reports.attendance.description')}
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
        <ReportKpiGrid cols={4}>
          <ReportKpiTile
            label={t('reports.attendance.kpi.total')}
            value={formatNumber(summary.total)}
            icon={Clock}
            accent="brand"
          />
          <ReportKpiTile
            label={t('reports.attendance.kpi.clockIns')}
            value={formatNumber(summary.clockIns)}
            icon={LogIn}
            accent="success"
          />
          <ReportKpiTile
            label={t('reports.attendance.kpi.clockOuts')}
            value={formatNumber(summary.clockOuts)}
            icon={LogOut}
            accent="info"
          />
          <ReportKpiTile
            label={t('reports.attendance.kpi.uniqueUsers')}
            value={formatNumber(summary.uniqueUsers)}
            icon={Users}
            accent="warning"
          />
        </ReportKpiGrid>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.attendance.tableTitle')}</CardTitle>
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

function TimeEntryBadge({ type }: { type: AttendanceRow['eventType'] }) {
  const t = useTranslations();
  const variant: 'success' | 'info' | 'warning' | 'muted' =
    type === 'CLOCK_IN'
      ? 'success'
      : type === 'CLOCK_OUT'
        ? 'info'
        : type === 'BREAK_START'
          ? 'warning'
          : 'muted';
  return <Badge variant={variant}>{t(`attendance.${labelKey(type)}`)}</Badge>;
}

function labelKey(type: AttendanceRow['eventType']): string {
  if (type === 'CLOCK_IN') return 'clockIn';
  if (type === 'CLOCK_OUT') return 'clockOut';
  if (type === 'BREAK_START') return 'breakStart';
  return 'breakEnd';
}
