'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { OccurrenceStatusBadge } from '@/components/shared/status-badge';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { useOccurrences } from '@/features/alerts/use-occurrences';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import type { AlertOccurrence } from '@/types/api';

const initialFilters = {
  status: '',
  startDate: last7DaysISO(),
  endDate: nowISO(),
};

export default function AlertOccurrencesPage() {
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

  const { data, isLoading } = useOccurrences(queryParams);

  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;

  if (totalCount !== pagination.totalCount) {
    pagination.setTotalCount(totalCount);
  }

  const columns: Column<AlertOccurrence>[] = [
    {
      key: 'site',
      headerKey: 'common.site',
      render: (item) => (typeof item.site === 'object' ? item.site?.name : '—'),
    },
    {
      key: 'client',
      headerKey: 'common.client',
      render: (item) => (typeof item.client === 'object' ? item.client?.name : '—'),
    },
    {
      key: 'equipment',
      headerKey: 'alerts.equipment',
      render: (item) => (typeof item.equipment === 'object' ? item.equipment?.name : '—'),
    },
    {
      key: 'scheduledAt',
      headerKey: 'alerts.scheduledAt',
      render: (item) => new Date(item.scheduledAt).toLocaleString(),
    },
    {
      key: 'respondedAt',
      headerKey: 'alerts.respondedAt',
      render: (item) =>
        item.respondedAt ? new Date(item.respondedAt).toLocaleString() : '—',
    },
    {
      key: 'status',
      headerKey: 'alerts.status',
      render: (item) => <OccurrenceStatusBadge status={item.status} />,
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
    <div className="space-y-6">
      <PageHeader title={t('alerts.timeline')} description={t('alerts.maxDateRange')} />

      <FilterPanel
        extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
        fields={[
          { key: 'startDate', labelKey: 'common.startDate', type: 'date' },
          { key: 'endDate', labelKey: 'common.endDate', type: 'date' },
          {
            key: 'status',
            labelKey: 'alerts.status',
            type: 'select',
            options: [
              { value: 'PENDING', label: t('alerts.pending') },
              { value: 'RESPONDED', label: t('alerts.responded') },
              { value: 'MISSED', label: t('alerts.missed') },
            ],
          },
        ]}
        values={filters}
        onChange={setFilter}
        onSearch={handleSearch}
        onClear={handleClear}
      />

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
        emptyTitle={t('common.noResults')}
      />
    </div>
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
