'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, MapPin, QrCode } from 'lucide-react';
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
import { SiteFormDialog } from '@/features/sites/site-form-dialog';
import { SiteQrDialog } from '@/features/sites/site-qr-dialog';
import { companyService } from '@/services/company.service';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import type { Company } from '@/types/api';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import { maskPhoneBR } from '@/lib/br-masks';

export default function SitesPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters: { name: '', status: 'ACTIVE' },
  });
  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeFilters, setActiveFilters] = useState(filters);
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Company | undefined>();
  const [qrTarget, setQrTarget] = useState<Company | undefined>();

  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sites', queryParams],
    queryFn: () => companyService.filterSites(queryParams),
  });

  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;
  if (totalCount !== pagination.totalCount) pagination.setTotalCount(totalCount);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companyService.delete(id),
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'site');
      toast.success(t('sites.deleteSuccess'));
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const columns: Column<Company>[] = [
    {
      key: 'name',
      headerKey: 'common.name',
      render: (item) => <p className="font-medium text-white">{item.name}</p>,
    },
    {
      key: 'client',
      headerKey: 'common.client',
      render: (item) => (typeof item.client === 'object' ? item.client?.name : '-'),
    },
    {
      key: 'address',
      headerKey: 'common.address',
      render: (item) => {
        const a = item.address;
        if (!a) return '-';
        const parts = [a.address, a.number, a.neighborhood, a.city, a.state].filter(Boolean);
        return parts.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-text-secondary">
            <MapPin className="h-3 w-3" />
            {parts.join(', ')}
          </span>
        ) : (
          '-'
        );
      },
    },
    {
      key: 'primaryPhone',
      headerKey: 'common.phone',
      render: (item) => (item.primaryPhone ? maskPhoneBR(item.primaryPhone) : '-'),
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
            title={t('sites.qrTitle')}
            onClick={(e) => {
              e.stopPropagation();
              setQrTarget(item);
            }}
          >
            <QrCode className="h-4 w-4" />
          </Button>
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
      <ModuleGuard moduleKey="SITES">
      <div className="space-y-6">
        <PageHeader
          title={t('sites.title')}
          action={
            <GatedCreateButton
              resource="sites"
              data-tour="page-sites-create"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('sites.createSite')}
            </GatedCreateButton>
          }
        />

        <FilterPanel
          extras={
            <HierarchyFilters value={hierarchy} onChange={setHierarchy} showSite={false} />
          }
          fields={[
            { key: 'name', labelKey: 'common.name', type: 'text' },
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
        />

        <SiteFormDialog open={formOpen} onOpenChange={setFormOpen} site={editing} />
        <SiteQrDialog
          open={!!qrTarget}
          onOpenChange={(open) => !open && setQrTarget(undefined)}
          site={qrTarget}
        />
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(undefined)}
          title={t('sites.deleteConfirm')}
          description={deleteTarget?.name || ''}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
          isLoading={deleteMutation.isPending}
        />
      </div>
      </ModuleGuard>
    </RoleGuard>
  );
}
