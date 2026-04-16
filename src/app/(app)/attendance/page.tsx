'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { TimeEntryBadge } from '@/components/shared/status-badge';
import { useTimeEntries } from '@/features/alerts/use-occurrences';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import type { TimeEntry } from '@/types/api';

export default function AttendancePage() {
  const t = useTranslations();
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters: {
      eventType: '',
      startDate: last7DaysISO(),
      endDate: nowISO(),
    },
  });

  const [activeFilters, setActiveFilters] = useState(filters);
  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
  };

  const { data, isLoading } = useTimeEntries(queryParams);
  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;

  if (totalCount !== pagination.totalCount) {
    pagination.setTotalCount(totalCount);
  }

  const columns: Column<TimeEntry>[] = [
    {
      key: 'timestamp',
      headerKey: 'attendance.timestamp',
      render: (item) => new Date(item.timestamp).toLocaleString(),
    },
    {
      key: 'user',
      headerKey: 'attendance.employee',
      render: (item) => (item.user ? `${item.user.firstName} ${item.user.lastName}` : '—'),
    },
    {
      key: 'eventType',
      headerKey: 'attendance.eventType',
      render: (item) => <TimeEntryBadge type={item.eventType} />,
    },
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
  ];

  const handleSearch = () => {
    pagination.setPage(1);
    setActiveFilters(filters);
  };

  const handleClear = () => {
    clearFilters();
    setActiveFilters({});
    pagination.setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('attendance.title')} description={t('attendance.timeEntries')} />

      <FilterPanel
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
