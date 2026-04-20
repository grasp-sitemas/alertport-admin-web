'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock, Gauge, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/shared/data-table';
import { RoleGuard } from '@/components/shared/role-guard';
import { useSlaReport } from '@/features/reports/use-reports';
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
import type { ReportFilterParams, SlaRow } from '@/types/reports';
import type { ExportPayload } from '@/features/reports/report-export';

const DEFAULT_SLA_THRESHOLD_SEC = 60;

/**
 * SLA de Atendimento — KPI contratual de resposta a SOS. Mede o
 * tempo entre disparo (`patrol_action.date`) e abertura de
 * atendimento (`attendance.openedDate`), além do tempo de
 * resolução (`openedDate → closedDate`). Inclui p50/p95 e % dentro
 * do threshold configurável.
 */
export default function SlaReportPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER']}>
      <SlaPageBody />
    </RoleGuard>
  );
}

function SlaPageBody() {
  const t = useTranslations();

  const [filterValue, setFilterValue] = useState<ReportFilterValue>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { hierarchy: {}, startDate, endDate };
  });
  const [slaThresholdSec, setSlaThresholdSec] = useState<number>(DEFAULT_SLA_THRESHOLD_SEC);
  const [appliedFilter, setAppliedFilter] = useState<
    (ReportFilterParams & { slaThresholdSec?: number }) | null
  >(() => {
    const { startDate, endDate } = defaultReportRange();
    return { startDate, endDate, slaThresholdSec: DEFAULT_SLA_THRESHOLD_SEC };
  });

  const apply = useCallback(() => {
    if (!validateReportFilter(filterValue).ok) return;
    setAppliedFilter({
      startDate: filterValue.startDate,
      endDate: filterValue.endDate,
      ...(filterValue.hierarchy.account ? { account: filterValue.hierarchy.account } : {}),
      ...(filterValue.hierarchy.client ? { client: filterValue.hierarchy.client } : {}),
      ...(filterValue.hierarchy.site ? { site: filterValue.hierarchy.site } : {}),
      slaThresholdSec: Math.max(1, Math.floor(Number(slaThresholdSec) || DEFAULT_SLA_THRESHOLD_SEC)),
    });
  }, [filterValue, slaThresholdSec]);

  const clear = useCallback(() => {
    const { startDate, endDate } = defaultReportRange();
    setFilterValue({ hierarchy: {}, startDate, endDate });
    setSlaThresholdSec(DEFAULT_SLA_THRESHOLD_SEC);
    setAppliedFilter({ startDate, endDate, slaThresholdSec: DEFAULT_SLA_THRESHOLD_SEC });
  }, []);

  const query = useSlaReport(appliedFilter);
  const data = query.data;
  const summary = data?.summary;
  const rows = useMemo<SlaRow[]>(() => data?.results ?? [], [data]);
  const operators = useMemo(() => data?.operators ?? [], [data]);

  const columns = useMemo<Column<SlaRow>[]>(
    () => [
      {
        key: 'date',
        headerKey: 'reports.sla.date',
        render: (r) => new Date(r.date).toLocaleString(),
      },
      {
        key: 'site',
        headerKey: 'common.site',
        render: (r) => r.site?.name ?? '—',
      },
      {
        key: 'operator',
        headerKey: 'reports.sla.operator',
        render: (r) =>
          r.operator
            ? `${r.operator.firstName ?? ''} ${r.operator.lastName ?? ''}`.trim() || '—'
            : '—',
      },
      {
        key: 'responseTime',
        headerKey: 'reports.sla.responseTime',
        render: (r) => formatSeconds(r.responseTimeSec),
      },
      {
        key: 'resolutionTime',
        headerKey: 'reports.sla.resolutionTime',
        render: (r) => formatSeconds(r.resolutionTimeSec),
      },
      {
        key: 'status',
        headerKey: 'reports.sla.attendanceStatus',
        render: (r) => r.attendance?.status ?? '—',
      },
    ],
    [],
  );

  const getExportPayload = useCallback((): ExportPayload<SlaRow> | null => {
    if (!summary || rows.length === 0) return null;
    return {
      fileName: 'sla_atendimento',
      title: t('reports.sla.title'),
      subtitle: `${filterValue.startDate} — ${filterValue.endDate}`,
      generatedAt: data?.generatedAt || new Date().toISOString(),
      kpis: [
        { label: t('reports.sla.kpi.compliance'), value: formatPercent(summary.slaCompliance) },
        { label: t('reports.sla.kpi.threshold'), value: formatSeconds(summary.slaThresholdSec) },
        { label: t('reports.sla.kpi.avgResponse'), value: formatSeconds(summary.avgResponseTimeSec) },
        { label: t('reports.sla.kpi.p50Response'), value: formatSeconds(summary.p50ResponseTimeSec) },
        { label: t('reports.sla.kpi.p95Response'), value: formatSeconds(summary.p95ResponseTimeSec) },
        { label: t('reports.sla.kpi.avgResolution'), value: formatSeconds(summary.avgResolutionTimeSec) },
        { label: t('reports.sla.kpi.total'), value: formatNumber(summary.total) },
      ],
      columns: [
        { header: t('reports.sla.date'), value: (r) => new Date(r.date) },
        { header: t('common.site'), value: (r) => r.site?.name ?? '' },
        {
          header: t('reports.sla.operator'),
          value: (r) =>
            r.operator ? `${r.operator.firstName ?? ''} ${r.operator.lastName ?? ''}`.trim() : '',
        },
        {
          header: t('reports.sla.responseTime'),
          value: (r) => (r.responseTimeSec != null ? Math.round(r.responseTimeSec) : ''),
        },
        {
          header: t('reports.sla.resolutionTime'),
          value: (r) => (r.resolutionTimeSec != null ? Math.round(r.resolutionTimeSec) : ''),
        },
        { header: t('reports.sla.attendanceStatus'), value: (r) => r.attendance?.status ?? '' },
      ],
      rows,
    };
  }, [data?.generatedAt, filterValue.endDate, filterValue.startDate, rows, summary, t]);

  return (
    <ReportPageLayout
      title={t('reports.sla.title')}
      description={t('reports.sla.description')}
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
                htmlFor="sla-threshold"
                className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1 block"
                title={t('reports.sla.thresholdHint')}
              >
                {t('reports.sla.thresholdLabel')}
              </label>
              <Input
                id="sla-threshold"
                type="number"
                min={1}
                max={3600}
                step={1}
                className="h-9 px-3 text-sm"
                value={slaThresholdSec}
                onChange={(e) => setSlaThresholdSec(Number(e.target.value))}
                title={t('reports.sla.thresholdHint')}
              />
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
        <>
          <ReportKpiGrid cols={4}>
            <ReportKpiTile
              label={t('reports.sla.kpi.compliance')}
              value={formatPercent(summary.slaCompliance)}
              hint={t('reports.sla.kpi.complianceHint', {
                threshold: formatSeconds(summary.slaThresholdSec),
              })}
              icon={Gauge}
              accent="success"
            />
            <ReportKpiTile
              label={t('reports.sla.kpi.avgResponse')}
              value={formatSeconds(summary.avgResponseTimeSec)}
              icon={Clock}
              accent="brand"
            />
            <ReportKpiTile
              label={t('reports.sla.kpi.p95Response')}
              value={formatSeconds(summary.p95ResponseTimeSec)}
              icon={TrendingUp}
              accent="warning"
            />
            <ReportKpiTile
              label={t('reports.sla.kpi.withinSla')}
              value={`${formatNumber(summary.withinSlaCount)} / ${formatNumber(summary.total)}`}
              icon={CheckCircle2}
              accent="info"
            />
          </ReportKpiGrid>

          <ReportKpiGrid cols={3}>
            <ReportKpiTile
              label={t('reports.sla.kpi.p50Response')}
              value={formatSeconds(summary.p50ResponseTimeSec)}
              accent="info"
            />
            <ReportKpiTile
              label={t('reports.sla.kpi.avgResolution')}
              value={formatSeconds(summary.avgResolutionTimeSec)}
              accent="info"
            />
            <ReportKpiTile
              label={t('reports.sla.kpi.p95Resolution')}
              value={formatSeconds(summary.p95ResolutionTimeSec)}
              accent="info"
            />
          </ReportKpiGrid>
        </>
      )}

      {operators.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.sla.operatorBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {operators.map((op) => {
                const name = op.operator
                  ? `${op.operator.firstName ?? ''} ${op.operator.lastName ?? ''}`.trim()
                  : '—';
                return (
                  <div
                    key={op._id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <p className="text-sm font-medium text-white truncate">{name || '—'}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {t('reports.sla.operatorAttendances', { count: op.count })} ·{' '}
                      {t('reports.sla.operatorAvg', {
                        avg: formatSeconds(op.avgResponseTimeSec),
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('reports.sla.tableTitle')}</CardTitle>
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
