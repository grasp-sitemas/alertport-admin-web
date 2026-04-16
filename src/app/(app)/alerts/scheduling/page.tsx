'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/shared/role-guard';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { useAlertSchedules } from '@/features/alerts/use-occurrences';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import { ScheduleFormDialog } from '@/features/alerts/schedule-form-dialog';
import type { AlertSchedule } from '@/types/api';

export default function AlertSchedulingPage() {
  const t = useTranslations();
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters: { name: '', status: 'ACTIVE' },
  });
  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeFilters, setActiveFilters] = useState(filters);
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AlertSchedule | undefined>();

  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { site: activeHierarchy.site } : {}),
    category: 'ALERT_CHECK',
  };

  const { data, isLoading } = useAlertSchedules(queryParams);
  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;

  if (totalCount !== pagination.totalCount) {
    pagination.setTotalCount(totalCount);
  }

  const handleEdit = (schedule: AlertSchedule) => {
    setEditingSchedule(schedule);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingSchedule(undefined);
    setDialogOpen(true);
  };

  const columns: Column<AlertSchedule>[] = [
    {
      key: 'name',
      headerKey: 'alerts.scheduleName',
      render: (item) => <span className="font-medium text-white">{item.name || '—'}</span>,
    },
    {
      key: 'date',
      headerKey: 'common.date',
      render: (item) => formatDate(pickEventDateTime(item)),
    },
    {
      key: 'time',
      headerKey: 'common.time',
      render: (item) => formatTime(pickEventDateTime(item), item.beginHour),
    },
    {
      key: 'actions',
      headerKey: 'common.actions',
      render: (item) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(item);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN', 'MANAGER']}>
      <div className="space-y-6">
        <PageHeader
          title={t('alerts.scheduling')}
          action={
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4" />
              {t('alerts.createSchedule')}
            </Button>
          }
        />

        <FilterPanel
          extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
          fields={[
            { key: 'name', labelKey: 'alerts.scheduleName', type: 'text' },
            {
              key: 'status',
              labelKey: 'common.status',
              type: 'select',
              options: [
                { value: 'ACTIVE', label: t('common.active') },
                { value: 'ARCHIVED', label: t('common.archived') },
              ],
            },
          ]}
          values={filters}
          onChange={setFilter}
          onSearch={() => {
            pagination.setPage(1);
            setActiveFilters(filters);
            setActiveHierarchy(hierarchy);
          }}
          onClear={() => {
            clearFilters();
            setActiveFilters({ name: '', status: 'ACTIVE' });
            setHierarchy({});
            setActiveHierarchy({});
            pagination.setPage(1);
          }}
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
          onRowClick={handleEdit}
        />

        <ScheduleFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          schedule={editingSchedule}
        />
      </div>
    </RoleGuard>
  );
}

/**
 * Pulls a usable Date string out of the appointment / schedule row.
 * Prefers the appointment-specific `startDate` / `start` fields the filter
 * endpoint returns for rendered occurrences; falls back to the schedule's
 * own `beginDate` for plain rows.
 */
function pickEventDateTime(item: AlertSchedule): string | undefined {
  return (
    item.startDate ??
    item.start ??
    item.appointment?.startDate ??
    item.appointment?.start ??
    item.beginDate ??
    undefined
  );
}

function formatDate(raw: string | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    // Backend sometimes returns a plain YYYY-MM-DD — display as-is (dd/mm/yyyy).
    const [y, m, day] = raw.split('-');
    if (y && m && day) return `${day}/${m}/${y}`;
    return '—';
  }
  return d.toLocaleDateString();
}

function formatTime(raw: string | undefined, fallback?: string): string {
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
  }
  // Legacy may return the hour separately (HH:mm)
  return (fallback?.trim()) || '—';
}
