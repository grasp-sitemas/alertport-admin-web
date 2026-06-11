'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, ClipboardList, Headset, XCircle } from 'lucide-react';
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
import { useOperatorAttendanceReport } from '@/features/reports/use-reports';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { ReportFilterPanel, type ReportFilterValue } from '@/features/reports/report-filter-panel';
import { ReportExportButton } from '@/features/reports/report-export-button';
import { ReportPageLayout } from '@/features/reports/report-page-layout';
import { ReportKpiGrid, ReportKpiTile, formatNumber, formatPercent } from '@/features/reports/report-kpi';
import { defaultReportRange, validateReportFilter } from '@/features/reports/report-filter-validator';
import { toIsoEndOfDay, toIsoStartOfDay } from '@/lib/date-range';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';
import type {
  OperatorAttendanceMode,
  OperatorAttendanceRow,
  ReportFilterParams,
} from '@/types/reports';
import type { ExportPayload } from '@/features/reports/report-export';

// The 11 pre-built operator action codes served by ms-user at
// `/api/helpers/data/events/attendances/types/v1/`. We translate the
// codes locally (i18n `reports.actionType.<code>`) and fall back to the
// raw code for any future code not yet mapped here.
const KNOWN_ACTION_CODES = new Set([
  'CALL_CLIENT',
  'CALL_VIGILANT',
  'CALL_SUPERVISOR',
  'CALL_POLICE',
  'CALL_FIREMEN',
  'REPORT_ACCIDENTAL_SOS',
  'REPORT_UNDUE_SOS',
  'REPORT_TEST_BY_CUSTOMER',
  'REPORT_TEST_BY_THIRD_PARTIES',
  'REPORT_FAILURE_TO_CONTACT_PRIORITY_PHONES',
  'OTHERS',
]);

const KNOWN_EVENT_TYPES = new Set(['OCCURRENCE_MISSED', 'SOS_ALERT']);

const MODE_OPTIONS: OperatorAttendanceMode[] = ['all', 'attended', 'not_attended'];

type AppliedFilter = ReportFilterParams & { mode?: OperatorAttendanceMode };

/**
 * Atendimento do Operador - notificações de alerta não atendido (e SOS)
 * que chegam ao operador no web, com as AÇÕES e OBSERVAÇÕES que ele
 * registrou. Uma notificação com N ações vira N linhas; uma notificação
 * sem ação aparece como "Não atendido". O filtro de modo isola os dois
 * casos (todas / atendidas / não atendidas).
 */
export default function OperatorAttendanceReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="REPORTS">
        <OperatorAttendancePageBody />
      </ModuleGuard>
    </RoleGuard>
  );
}

function OperatorAttendancePageBody() {
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const showAccountColumn = isSuperAdminMaster(userSubtype);

  const [filterValue, setFilterValue] = useState<ReportFilterValue>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { hierarchy: {}, startDate, endDate };
  });
  const [mode, setMode] = useState<OperatorAttendanceMode>('all');
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter | null>(() => {
    const { startDate, endDate } = defaultReportRange();
    return {
      startDate: toIsoStartOfDay(startDate),
      endDate: toIsoEndOfDay(endDate),
      mode: 'all',
    };
  });

  const query = useOperatorAttendanceReport(appliedFilter);

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
  // Chronological reading order - oldest first by notification date,
  // then by action timestamp within the same notification.
  const rows = useMemo<OperatorAttendanceRow[]>(() => {
    const list = data?.results ?? [];
    return [...list].sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (byDate !== 0) return byDate;
      const at = a.actionDate ? new Date(a.actionDate).getTime() : 0;
      const bt = b.actionDate ? new Date(b.actionDate).getTime() : 0;
      return at - bt;
    });
  }, [data]);
  const pagination = useClientPagination(rows, { initialPageSize: 20 });

  const eventLabel = useCallback(
    (type: string): string =>
      KNOWN_EVENT_TYPES.has(type) ? t(`reports.operatorAttendance.eventType.${type}`) : type,
    [t],
  );
  const actionLabel = useCallback(
    (code?: string | null): string => {
      if (!code) return t('reports.operatorAttendance.noAction');
      return KNOWN_ACTION_CODES.has(code) ? t(`reports.actionType.${code}`) : code;
    },
    [t],
  );

  const columns = useMemo<Column<OperatorAttendanceRow>[]>(
    () => [
      {
        key: 'date',
        headerKey: 'reports.operatorAttendance.date',
        render: (r) => new Date(r.date).toLocaleString(),
      },
      ...(showAccountColumn
        ? ([
            {
              key: 'account',
              headerKey: 'common.account',
              render: (r: OperatorAttendanceRow) => r.account?.name ?? '-',
            },
          ] as Column<OperatorAttendanceRow>[])
        : []),
      { key: 'client', headerKey: 'common.client', render: (r) => r.client?.name ?? '-' },
      { key: 'site', headerKey: 'common.site', render: (r) => r.site?.name ?? '-' },
      {
        key: 'event',
        headerKey: 'reports.operatorAttendance.event',
        render: (r) => eventLabel(r.type),
      },
      {
        key: 'operator',
        headerKey: 'reports.operatorAttendance.operator',
        render: (r) =>
          r.operator
            ? `${r.operator.firstName ?? ''} ${r.operator.lastName ?? ''}`.trim() || '-'
            : '-',
      },
      {
        key: 'action',
        headerKey: 'reports.operatorAttendance.action',
        render: (r) => actionLabel(r.action),
      },
      {
        key: 'notes',
        headerKey: 'reports.operatorAttendance.notes',
        render: (r) => r.notes?.trim() || '-',
      },
      {
        key: 'status',
        headerKey: 'reports.operatorAttendance.status',
        render: (r) => <AttendedBadge attended={r.attended} />,
      },
    ],
    [showAccountColumn, eventLabel, actionLabel],
  );

  const getExportPayload = useCallback((): ExportPayload<OperatorAttendanceRow> | null => {
    if (!summary || rows.length === 0) return null;
    return {
      fileName: 'atendimento_operador',
      title: t('reports.operatorAttendance.title'),
      subtitle: `${filterValue.startDate} - ${filterValue.endDate}`,
      generatedAt: data?.generatedAt || new Date().toISOString(),
      kpis: [
        {
          label: t('reports.operatorAttendance.kpi.total'),
          value: formatNumber(summary.totalNotifications),
        },
        {
          label: t('reports.operatorAttendance.kpi.attended'),
          value: formatNumber(summary.attendedNotifications),
        },
        {
          label: t('reports.operatorAttendance.kpi.notAttended'),
          value: formatNumber(summary.notAttendedNotifications),
        },
        {
          label: t('reports.operatorAttendance.kpi.totalActions'),
          value: formatNumber(summary.totalActions),
        },
        {
          label: t('reports.operatorAttendance.kpi.attendanceRate'),
          value: formatPercent(summary.attendanceRate),
        },
      ],
      columns: [
        { header: t('reports.operatorAttendance.date'), value: (r) => new Date(r.date) },
        ...(showAccountColumn
          ? [{ header: t('common.account'), value: (r: OperatorAttendanceRow) => r.account?.name ?? '' }]
          : []),
        { header: t('common.client'), value: (r) => r.client?.name ?? '' },
        { header: t('common.site'), value: (r) => r.site?.name ?? '' },
        { header: t('reports.operatorAttendance.event'), value: (r) => eventLabel(r.type) },
        {
          header: t('reports.operatorAttendance.operator'),
          value: (r) =>
            r.operator ? `${r.operator.firstName ?? ''} ${r.operator.lastName ?? ''}`.trim() : '',
        },
        { header: t('reports.operatorAttendance.action'), value: (r) => actionLabel(r.action) },
        { header: t('reports.operatorAttendance.notes'), value: (r) => r.notes ?? '' },
        {
          header: t('reports.operatorAttendance.status'),
          value: (r) =>
            r.attended
              ? t('reports.operatorAttendance.statusValue.attended')
              : t('reports.operatorAttendance.statusValue.not_attended'),
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
    eventLabel,
    actionLabel,
    t,
  ]);

  return (
    <ReportPageLayout
      title={t('reports.operatorAttendance.title')}
      description={t('reports.operatorAttendance.description')}
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
                htmlFor="operator-attendance-mode"
                className="text-text-secondary mb-1 block text-[10px] font-semibold tracking-wider uppercase"
                title={t('reports.operatorAttendance.modeHint')}
              >
                {t('reports.operatorAttendance.modeLabel')}
              </label>
              <Select value={mode} onValueChange={(v) => setMode(v as OperatorAttendanceMode)}>
                <SelectTrigger id="operator-attendance-mode" className="h-9 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`reports.operatorAttendance.mode.${m}`)}
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
            label={t('reports.operatorAttendance.kpi.total')}
            value={formatNumber(summary.totalNotifications)}
            icon={ClipboardList}
            accent="brand"
          />
          <ReportKpiTile
            label={t('reports.operatorAttendance.kpi.attended')}
            value={formatNumber(summary.attendedNotifications)}
            icon={CheckCircle2}
            accent="success"
          />
          <ReportKpiTile
            label={t('reports.operatorAttendance.kpi.notAttended')}
            value={formatNumber(summary.notAttendedNotifications)}
            icon={XCircle}
            accent="warning"
          />
          <ReportKpiTile
            label={t('reports.operatorAttendance.kpi.attendanceRate')}
            value={formatPercent(summary.attendanceRate)}
            hint={t('reports.operatorAttendance.kpi.totalActionsHint', {
              count: summary.totalActions,
            })}
            icon={Headset}
            accent="info"
          />
        </ReportKpiGrid>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.operatorAttendance.tableTitle')}</CardTitle>
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
            getRowKey={(r) => (r.actionId ? `${r._id}:${r.actionId}` : r._id)}
          />
        </CardContent>
      </Card>
    </ReportPageLayout>
  );
}

// Attended → success badge; not attended → danger badge. Mirrors the
// status badges in the SLA/SOS reports so the three look consistent.
function AttendedBadge({ attended }: { attended: boolean }) {
  const t = useTranslations();
  return attended ? (
    <Badge variant="success">{t('reports.operatorAttendance.statusValue.attended')}</Badge>
  ) : (
    <Badge variant="danger">{t('reports.operatorAttendance.statusValue.not_attended')}</Badge>
  );
}
