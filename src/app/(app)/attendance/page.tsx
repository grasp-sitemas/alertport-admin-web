'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { TimeEntryBadge } from '@/components/shared/status-badge';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { useTimeEntries } from '@/features/alerts/use-occurrences';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import { RoleGuard } from '@/components/shared/role-guard';
import type { TimeEntry } from '@/types/api';

const initialFilters = {
  eventType: '',
  startDate: last7DaysISO(),
  endDate: nowISO(),
};

export default function AttendancePage() {
  const t = useTranslations();
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters,
  });

  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(initialFilters);
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});

  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { site: activeHierarchy.site } : {}),
  };

  const { data, isLoading, isError, error, refetch } = useTimeEntries(queryParams);
  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;

  if (totalCount !== pagination.totalCount) {
    pagination.setTotalCount(totalCount);
  }

  const columns: Column<TimeEntry>[] = [
    {
      key: 'timestamp',
      headerKey: 'attendance.timestamp',
      render: (item) => formatTimestamp(item),
    },
    {
      key: 'user',
      headerKey: 'attendance.employee',
      render: (item) => {
        if (!item.user) return '-';
        const full =
          item.user.fullName ??
          `${item.user.firstName ?? ''} ${item.user.lastName ?? ''}`.trim();
        return full || '-';
      },
    },
    {
      key: 'eventType',
      headerKey: 'attendance.eventType',
      render: (item) => <TimeEntryBadge type={item.eventType} />,
    },
    {
      key: 'client',
      headerKey: 'common.client',
      render: (item) => (typeof item.client === 'object' ? item.client?.name : '-'),
    },
    {
      key: 'site',
      headerKey: 'common.site',
      render: (item) => (typeof item.site === 'object' ? item.site?.name : '-'),
    },
    {
      key: 'equipment',
      headerKey: 'alerts.equipment',
      render: (item) => (typeof item.equipment === 'object' ? item.equipment?.name : '-'),
    },
  ];

  const handleSearch = () => {
    pagination.setPage(1);
    setActiveFilters(filters);
    setActiveHierarchy(hierarchy);
  };

  const handleClear = () => {
    clearFilters();
    setActiveFilters(initialFilters);
    setHierarchy({});
    setActiveHierarchy({});
    pagination.setPage(1);
  };

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <div className="space-y-6">
      <PageHeader title={t('attendance.title')} description={t('attendance.timeEntries')} />

      <FilterPanel
        extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
        fields={[
          { key: 'startDate', labelKey: 'common.startDate', type: 'date' },
          { key: 'endDate', labelKey: 'common.endDate', type: 'date' },
          {
            key: 'eventType',
            labelKey: 'attendance.eventType',
            type: 'select',
            options: [
              { value: 'CLOCK_IN', label: t('attendance.clockIn') },
              { value: 'CLOCK_OUT', label: t('attendance.clockOut') },
              { value: 'BREAK_START', label: t('attendance.breakStart') },
              { value: 'BREAK_END', label: t('attendance.breakEnd') },
            ],
          },
        ]}
        values={filters}
        onChange={setFilter}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      {isError ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-4 text-sm text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t('notifications.errorOccurred')}</p>
              {error instanceof Error && error.message && (
                <p className="text-xs text-red-200/80 mt-0.5">{error.message}</p>
              )}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>
            {t('common.refresh')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={results}
          isLoading={isLoading}
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          getRowKey={(item) => item._id}
        />
      )}
      </div>
    </RoleGuard>
  );
}

function last7DaysISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}
function nowISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Backend returns `createdAt` for time entries; legacy shieldgo mapped it to
 * `timestamp` client-side. Accept both so the column never shows "Invalid Date".
 */
function formatTimestamp(item: TimeEntry): string {
  const raw = item.createdAt ?? item.timestamp ?? item.createdDate;
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}
