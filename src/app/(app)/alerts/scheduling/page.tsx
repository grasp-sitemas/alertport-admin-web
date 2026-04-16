'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { RoleGuard } from '@/components/shared/role-guard';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { useAlertSchedules } from '@/features/alerts/use-occurrences';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import { ScheduleFormDialog } from '@/features/alerts/schedule-form-dialog';
import type { AlertSchedule } from '@/types/api';
import { formatEnumLabel } from '@/lib/enum-labels';

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

  const frequencyLabels: Record<string, string> = {
    NOT_REPEAT: t('alerts.notRepeat'),
    DAILY: t('alerts.daily'),
    EVERY_OTHER_DAY: t('alerts.everyOtherDay'),
    WEEKLY: t('alerts.weekly'),
    MONTHLY: t('alerts.monthly'),
    YEARLY: t('alerts.yearly'),
  };

  const alertTypeLabels: Record<string, string> = {
    FIXED: t('alerts.fixed'),
    RANDOM: t('alerts.random'),
  };

  const columns: Column<AlertSchedule>[] = [
    { key: 'name', headerKey: 'alerts.scheduleName' },
    {
      key: 'client',
      headerKey: 'common.client',
      render: (item) => (typeof item.client === 'object' ? item.client?.name : '—'),
    },
    {
      key: 'site',
      headerKey: 'common.site',
      render: (item) => (typeof item.site === 'object' ? item.site?.name : '—'),
    },
    {
      key: 'equipment',
      headerKey: 'alerts.equipment',
      render: (item) => (typeof item.equipment === 'object' ? item.equipment?.name : '—'),
    },
    {
      key: 'frequency',
      headerKey: 'alerts.frequency',
      render: (item) => formatEnumLabel(item.frequency, frequencyLabels),
    },
    {
      key: 'alertType',
      headerKey: 'alerts.alertType',
      render: (item) => formatEnumLabel(item.alertConfig?.alertType, alertTypeLabels),
    },
    {
      key: 'beginHour',
      headerKey: 'alerts.beginHour',
      render: (item) => `${item.beginHour?.trim() || '—'} – ${item.endHour?.trim() || '—'}`,
    },
    {
      key: 'status',
      headerKey: 'common.status',
      render: (item) => <StatusBadge status={item.status} />,
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
