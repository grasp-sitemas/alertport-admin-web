'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ReportFilterPanel, type ReportFilterValue } from '@/features/reports/report-filter-panel';
import { ReportExportButton } from '@/features/reports/report-export-button';
import { ReportPageLayout } from '@/features/reports/report-page-layout';
import { ReportKpiGrid, ReportKpiTile, formatNumber } from '@/features/reports/report-kpi';
import {
  defaultReportRange,
  validateReportFilter,
} from '@/features/reports/report-filter-validator';
import type {
  DeviceEventReport,
  DeviceEventRow,
  ReportFilterParams,
} from '@/types/reports';
import type { ExportPayload } from '@/features/reports/report-export';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';

/**
 * Shared body for the five device-event reports (power, battery,
 * on/off, violation, remote-restart). They all consume the same
 * `DeviceEventReport` envelope from ms-report and render the same
 * table - only the title/description, the per-eventCategory KPI
 * mapping, the file name, and the underlying React Query hook differ.
 *
 * Keeping the logic in one place avoids 5x copy-paste drift; each
 * route page is reduced to a thin wrapper that supplies the variant.
 */

export interface DeviceEventKpiSpec {
  /** eventCategory key returned by the backend (e.g. POWER_LOSS). */
  category: string;
  /** i18n key under reports.<slug>.kpi.* for the label. */
  labelKey: string;
  accent: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  icon?: ComponentType<LucideProps>;
}

export interface DeviceEventQueryResult {
  data?: DeviceEventReport;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

export interface DeviceEventVariant {
  /** Used for query key, file prefix, and i18n namespace. */
  slug: string;
  /** Title icon (used on the total KPI tile). */
  totalIcon: ComponentType<LucideProps>;
  /** Per-category KPI tiles to render after the total. */
  kpis: DeviceEventKpiSpec[];
  /** File prefix for exports (e.g. "energia"). */
  fileName: string;
  /** React Query hook from use-reports.ts. */
  useReportHook: (filter: ReportFilterParams | null) => DeviceEventQueryResult;
}

interface Props {
  variant: DeviceEventVariant;
}

export function DeviceEventReportBody({ variant }: Props) {
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const showAccountColumn = isSuperAdminMaster(userSubtype);
  const ns = `reports.${variant.slug}`;

  const [filterValue, setFilterValue] = useState<ReportFilterValue>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { hierarchy: {}, startDate, endDate };
  });
  const [appliedFilter, setAppliedFilter] = useState<ReportFilterParams | null>(() => {
    const { startDate, endDate } = defaultReportRange();
    return { startDate, endDate };
  });

  const query = variant.useReportHook(appliedFilter);

  const apply = useCallback(() => {
    if (!validateReportFilter(filterValue).ok) return;
    setAppliedFilter({
      startDate: filterValue.startDate,
      endDate: filterValue.endDate,
      ...(filterValue.hierarchy.account ? { account: filterValue.hierarchy.account } : {}),
      ...(filterValue.hierarchy.client ? { client: filterValue.hierarchy.client } : {}),
      ...(filterValue.hierarchy.site ? { site: filterValue.hierarchy.site } : {}),
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
  const rows = useMemo<DeviceEventRow[]>(() => data?.results ?? [], [data]);

  const eventCategoryLabel = useCallback(
    (row: DeviceEventRow) => {
      // The backend returns a stable category code (POWER_LOSS, etc).
      // We translate via reports.eventCategory.<code> when present,
      // falling back to the raw code so unknown categories never blank.
      const key = `reports.eventCategory.${row.eventCategory}`;
      return t.has(key) ? t(key) : row.eventCategory;
    },
    [t],
  );

  const columns = useMemo<Column<DeviceEventRow>[]>(
    () => [
      {
        key: 'eventDate',
        headerKey: 'common.date',
        render: (r) => new Date(r.eventDate).toLocaleString(),
      },
      ...(showAccountColumn
        ? ([
            {
              key: 'account',
              headerKey: 'common.account',
              render: (r: DeviceEventRow) => r.account?.name ?? '-',
            },
          ] as Column<DeviceEventRow>[])
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
        key: 'equipment',
        headerKey: 'sidebar.equipment',
        render: (r) => r.equipment?.uniqueId ?? r.readerCode ?? '-',
      },
      {
        key: 'eventCategory',
        headerKey: 'reports.deviceEvent.eventType',
        render: (r) => eventCategoryLabel(r),
      },
      {
        key: 'deviceType',
        headerKey: 'reports.deviceEvent.deviceType',
        render: (r) => r.deviceType ?? '-',
      },
    ],
    [eventCategoryLabel, showAccountColumn],
  );

  const getExportPayload = useCallback((): ExportPayload<DeviceEventRow> | null => {
    if (!summary || rows.length === 0) return null;
    const kpiEntries = [
      { label: t(`${ns}.kpi.total`), value: formatNumber(summary.total) },
      ...variant.kpis.map((spec) => ({
        label: t(`${ns}.kpi.${spec.labelKey}`),
        value: formatNumber(summary.byType?.[spec.category] ?? 0),
      })),
    ];
    return {
      fileName: variant.fileName,
      title: t(`${ns}.title`),
      subtitle: `${filterValue.startDate} - ${filterValue.endDate}`,
      generatedAt: data?.generatedAt || new Date().toISOString(),
      kpis: kpiEntries,
      columns: [
        { header: t('common.date'), value: (r) => new Date(r.eventDate) },
        ...(showAccountColumn
          ? [{ header: t('common.account'), value: (r: DeviceEventRow) => r.account?.name ?? '' }]
          : []),
        { header: t('common.client'), value: (r) => r.client?.name ?? '' },
        { header: t('common.site'), value: (r) => r.site?.name ?? '' },
        {
          header: t('sidebar.equipment'),
          value: (r) => r.equipment?.uniqueId ?? r.readerCode ?? '',
        },
        {
          header: t('reports.deviceEvent.eventType'),
          value: (r) => eventCategoryLabel(r),
        },
        {
          header: t('reports.deviceEvent.deviceType'),
          value: (r) => r.deviceType ?? '',
        },
      ],
      rows,
    };
  }, [
    data?.generatedAt,
    eventCategoryLabel,
    filterValue.endDate,
    filterValue.startDate,
    ns,
    rows,
    showAccountColumn,
    summary,
    t,
    variant.fileName,
    variant.kpis,
  ]);

  const totalIconAccent = 'brand' as const;
  const kpiCount = 1 + variant.kpis.length;
  const gridCols = kpiCount >= 4 ? 4 : kpiCount >= 3 ? 3 : 2;

  return (
    <ReportPageLayout
      title={t(`${ns}.title`)}
      description={t(`${ns}.description`)}
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
        <ReportKpiGrid cols={gridCols}>
          <ReportKpiTile
            label={t(`${ns}.kpi.total`)}
            value={formatNumber(summary.total)}
            icon={variant.totalIcon}
            accent={totalIconAccent}
          />
          {variant.kpis.map((spec) => (
            <ReportKpiTile
              key={spec.category}
              label={t(`${ns}.kpi.${spec.labelKey}`)}
              value={formatNumber(summary.byType?.[spec.category] ?? 0)}
              icon={spec.icon}
              accent={spec.accent}
            />
          ))}
        </ReportKpiGrid>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t(`${ns}.tableTitle`)}</CardTitle>
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
