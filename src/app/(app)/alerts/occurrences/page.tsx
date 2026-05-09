'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { OccurrenceStatusBadge } from '@/components/shared/status-badge';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOccurrences } from '@/features/alerts/use-occurrences';
import { useEquipmentsBySiteLookup } from '@/features/shared/use-hierarchy-lookups';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';
import type { AlertOccurrence } from '@/types/api';

const initialFilters = {
  status: '',
  startDate: last7DaysISO(),
  endDate: nowISO(),
};

export default function AlertOccurrencesPage() {
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const showAccountColumn = isSuperAdminMaster(userSubtype);
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters,
  });

  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [equipmentId, setEquipmentId] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(initialFilters);
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeEquipmentId, setActiveEquipmentId] = useState<string>('');

  // Devices are only meaningful once a site is picked. Reset the local
  // selection whenever the site changes so a stale device id never leaks
  // into the next query.
  const equipmentsLookup = useEquipmentsBySiteLookup({
    account: hierarchy.account,
    client: hierarchy.client,
    site: hierarchy.site,
  });
  const equipmentOptions = equipmentsLookup.data?.results ?? [];

  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { site: activeHierarchy.site } : {}),
    ...(activeEquipmentId ? { equipment: activeEquipmentId } : {}),
  };

  const { data, isLoading, refetch } = useOccurrences(queryParams);

  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;

  if (totalCount !== pagination.totalCount) {
    pagination.setTotalCount(totalCount);
  }

  // Column order (user-facing requirement):
  //   1. Cliente, 2. Posto, 3. Equipamento, 4. Conta (SAM-only),
  //   5. Agendado, 6. Respondido, 7. Status.
  // "Conta" is SUPER_ADMIN_MASTER only — every other role is already
  // scoped to their own account via the session interceptor, so the
  // column would just echo their own company name.
  const columns: Column<AlertOccurrence>[] = [
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
    ...(showAccountColumn
      ? ([
          {
            key: 'account',
            headerKey: 'common.account',
            render: (item: AlertOccurrence) =>
              typeof item.account === 'object' ? (item.account?.name ?? '-') : '-',
          },
        ] as Column<AlertOccurrence>[])
      : []),
    {
      key: 'scheduledAt',
      headerKey: 'alerts.scheduledAt',
      render: (item) => new Date(item.scheduledAt).toLocaleString(),
    },
    {
      key: 'respondedAt',
      headerKey: 'alerts.respondedAt',
      render: (item) =>
        item.respondedAt ? new Date(item.respondedAt).toLocaleString() : '-',
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
    setActiveEquipmentId(equipmentId);
    // Force a network call even when the filter values are unchanged so
    // the operator can re-poll for fresh attendance state. Without this
    // the queryKey is identical and TanStack Query serves the cached
    // result, which made the Buscar button look broken on reclick.
    refetch();
  };

  const handleClear = () => {
    clearFilters();
    setActiveFilters(initialFilters);
    setHierarchy({});
    setActiveHierarchy({});
    setEquipmentId('');
    setActiveEquipmentId('');
    pagination.setPage(1);
  };

  // Reset device when its parent site changes so we never POST a stale
  // equipment id from a different site.
  const handleHierarchyChange = (next: HierarchyFiltersValue) => {
    if (next.site !== hierarchy.site) {
      setEquipmentId('');
    }
    setHierarchy(next);
  };

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="OCCURRENCES">
      <div className="space-y-6">
      <PageHeader title={t('alerts.timeline')} description={t('alerts.maxDateRange')} />

      {/* Two-row filter bar: hierarchy above, date/status + actions
          below. Kept on-page (instead of FilterPanel) so the three
          hierarchy selects share a row with the three detail fields
          sharing the second, matching the user's "2 linhas ao total"
          spec. */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.01] p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
          <HierarchyFilters value={hierarchy} onChange={handleHierarchyChange} compact />
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1 block">
              {t('common.device')}
            </label>
            <Select
              value={equipmentId || '__all__'}
              onValueChange={(val) => setEquipmentId(val === '__all__' ? '' : val)}
              disabled={!hierarchy.site}
            >
              <SelectTrigger className="h-9 px-3 text-sm">
                <SelectValue placeholder={t('common.selectOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('common.all')}</SelectItem>
                {equipmentOptions.map((eq) => (
                  <SelectItem key={eq._id} value={eq._id}>
                    {eq.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2 flex-1 min-w-0">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1 block">
                {t('common.startDate')}
              </label>
              <Input
                type="date"
                className="h-9"
                value={(filters.startDate as string) || ''}
                onChange={(e) => setFilter('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1 block">
                {t('common.endDate')}
              </label>
              <Input
                type="date"
                className="h-9"
                value={(filters.endDate as string) || ''}
                onChange={(e) => setFilter('endDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1 block">
                {t('alerts.status')}
              </label>
              <Select
                value={(filters.status as string) || '__all__'}
                onValueChange={(val) => setFilter('status', val === '__all__' ? '' : val)}
              >
                <SelectTrigger className="h-9 px-3 text-sm">
                  <SelectValue placeholder={t('common.selectOption')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('common.all')}</SelectItem>
                  <SelectItem value="PENDING">{t('alerts.pending')}</SelectItem>
                  <SelectItem value="RESPONDED">{t('alerts.responded')}</SelectItem>
                  <SelectItem value="MISSED">{t('alerts.missed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
              <X className="h-4 w-4" />
              {t('common.clearFilters')}
            </Button>
            <Button type="button" size="sm" onClick={handleSearch}>
              <Search className="h-4 w-4" />
              {t('common.search')}
            </Button>
          </div>
        </div>
      </div>

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
        // Carga inicial cronológica: data crescente + hora crescente.
        // `scheduledAt` é o campo canônico de agendamento e ordena tanto
        // dia quanto hora num único pass de Date.parse no DataTable.
        initialSort={{ key: 'scheduledAt', dir: 'asc' }}
      />
      </div>
      </ModuleGuard>
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
