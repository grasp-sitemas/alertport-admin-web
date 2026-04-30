'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, FileUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { GatedCreateButton } from '@/components/trial/gated-create-button';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { EquipmentFormDialog } from '@/features/equipment/equipment-form-dialog';
import { BulkImportDialog } from '@/features/bulk-import/bulk-import-dialog';
import { buildEquipmentBulkConfig } from '@/features/bulk-import/entity-configs';
import { useBulkImportResolvers } from '@/features/bulk-import/use-resolvers';
import { equipmentService } from '@/services/equipment.service';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import { useAuth } from '@/hooks/use-auth';
import type { Equipment } from '@/types/api';
import { translateDynamicLabel } from '@/lib/i18n-labels';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';

export default function EquipmentPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters: { name: '', status: 'ACTIVE', brand: '', type: '' },
  });
  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeFilters, setActiveFilters] = useState(filters);
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Equipment | undefined>();
  const [bulkOpen, setBulkOpen] = useState(false);
  const { user: sessionUser } = useAuth();
  const sessionAccountId =
    typeof sessionUser?.account === 'object' && sessionUser.account
      ? (sessionUser.account as { _id?: string })._id
      : typeof sessionUser?.account === 'string'
        ? sessionUser.account
        : undefined;
  const resolvers = useBulkImportResolvers({
    enabled: bulkOpen,
    sessionAccountId,
  });
  const bulkConfig = buildEquipmentBulkConfig(t, {
    fallbackAccountId: sessionAccountId,
    accountResolver: resolvers.accountResolver,
    clientResolver: resolvers.clientResolver,
    siteResolver: resolvers.siteResolver,
  });

  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { site: activeHierarchy.site } : {}),
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['equipment', queryParams],
    queryFn: () => equipmentService.filter(queryParams),
  });

  const brandsQuery = useQuery({
    queryKey: ['lookup', 'equipment-brands'],
    queryFn: () => equipmentService.getBrands(),
    staleTime: 5 * 60 * 1000,
  });
  const typesQuery = useQuery({
    queryKey: ['lookup', 'equipment-types'],
    queryFn: () => equipmentService.getTypes(),
    staleTime: 5 * 60 * 1000,
  });

  const results = data?.results ?? [];
  const totalCount = data?.totalCount ?? 0;
  if (totalCount !== pagination.totalCount) pagination.setTotalCount(totalCount);

  const archiveMutation = useMutation({
    mutationFn: (equipment: Equipment) => equipmentService.archive(equipment),
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'equipment');
      toast.success(t('equipment.deleteSuccess'));
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const typeLabels: Record<string, string> = Object.fromEntries(
    (typesQuery.data ?? []).map((tp) => [tp._id, translateDynamicLabel(tp.name, t)]),
  );
  const brandLabels: Record<string, string> = Object.fromEntries(
    (brandsQuery.data ?? []).map((b) => [b._id, translateDynamicLabel(b.name, t)]),
  );

  const columns: Column<Equipment>[] = [
    {
      key: 'code',
      headerKey: 'equipment.code',
      render: (item) => (
        <p className="font-medium text-white">{item.code ?? item.name ?? '-'}</p>
      ),
    },
    {
      key: 'type',
      headerKey: 'equipment.typeField',
      render: (item) =>
        item.type ? typeLabels[item.type] ?? translateDynamicLabel(item.type, t) : '-',
    },
    {
      key: 'brand',
      headerKey: 'equipment.brand',
      render: (item) =>
        item.brand ? brandLabels[item.brand] ?? translateDynamicLabel(item.brand, t) : '-',
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
      key: 'createDate',
      headerKey: 'common.createdAt',
      render: (item) => {
        const d = item.createDate ?? item.createdDate;
        return d ? new Date(d).toLocaleDateString() : '-';
      },
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
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(item);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-400 hover:bg-red-500/10"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(item);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER']}>
      <ModuleGuard moduleKey="EQUIPMENT">
      <div className="space-y-6">
        <PageHeader
          title={t('equipment.title')}
          action={
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setBulkOpen(true)}>
                <FileUp className="h-4 w-4" />
                {t('bulkImport.button')}
              </Button>
              <GatedCreateButton
                resource="devices"
                data-tour="page-equipment-create"
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                {t('equipment.createEquipment')}
              </GatedCreateButton>
            </div>
          }
        />

        <FilterPanel
          extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
          fields={[
            { key: 'name', labelKey: 'equipment.code', type: 'text' },
            {
              key: 'type',
              labelKey: 'equipment.typeField',
              type: 'select',
              options: (typesQuery.data ?? []).map((tp) => ({
                value: tp._id,
                label: translateDynamicLabel(tp.name, t),
              })),
            },
            {
              key: 'brand',
              labelKey: 'equipment.brand',
              type: 'select',
              options: (brandsQuery.data ?? []).map((b) => ({
                value: b._id,
                label: translateDynamicLabel(b.name, t),
              })),
            },
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
            refetch();
          }}
          onClear={() => {
            clearFilters();
            setHierarchy({});
            setActiveHierarchy({});
            setActiveFilters({ name: '', status: 'ACTIVE', brand: '', type: '' });
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
        />

        <EquipmentFormDialog open={formOpen} onOpenChange={setFormOpen} equipment={editing} />
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(undefined)}
          title={t('equipment.deleteConfirm')}
          description={deleteTarget?.code ?? deleteTarget?.name ?? ''}
          onConfirm={() => deleteTarget && archiveMutation.mutate(deleteTarget)}
          isLoading={archiveMutation.isPending}
        />
        <BulkImportDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          config={bulkConfig}
          onImported={() => invalidateHierarchyAfter(queryClient, 'equipment')}
        />
      </div>
      </ModuleGuard>
    </RoleGuard>
  );
}
