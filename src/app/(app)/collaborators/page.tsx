'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { GatedCreateButton } from '@/components/trial/gated-create-button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { CollaboratorFormDialog } from '@/features/collaborators/collaborator-form-dialog';
import { usersService } from '@/services/users.service';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import type { User } from '@/types/api';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import { maskPhoneBR } from '@/lib/br-masks';

const SUBTYPE_LABELS: Record<string, string> = {
  VIGILANT: 'collaborators.vigilant',
  SUPERVISOR: 'collaborators.supervisor',
};

export default function CollaboratorsPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters: { name: '', status: 'ACTIVE', subtype: '' },
  });
  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeFilters, setActiveFilters] = useState(filters);
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<User | undefined>();

  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { site: activeHierarchy.site } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['collaborators', queryParams],
    queryFn: () => usersService.filterCollaborators(queryParams),
  });

  const results = data?.results ?? [];
  const totalCount = data?.totalCount ?? 0;
  if (totalCount !== pagination.totalCount) pagination.setTotalCount(totalCount);

  const deleteMutation = useMutation({
    mutationFn: (user: User) =>
      usersService.deleteCollaborator(user.email, user as unknown as Record<string, unknown>),
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'user');
      toast.success(t('collaborators.deleteSuccess'));
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const columns: Column<User>[] = [
    {
      key: 'fullName',
      headerKey: 'common.name',
      render: (item) => {
        const name =
          item.fullName ?? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
        return <p className="font-medium text-white">{name || '-'}</p>;
      },
    },
    {
      key: 'employeeCode',
      headerKey: 'collaborators.employeeCode',
      render: (item) => item.customerUser?.employeeCode || '-',
    },
    {
      key: 'subtype',
      headerKey: 'collaborators.type',
      render: (item) => {
        const k = item.customerUser?.subtype;
        return k ? (
          <Badge variant="brand">{t(SUBTYPE_LABELS[k] ?? 'common.info')}</Badge>
        ) : (
          '-'
        );
      },
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
    { key: 'email', headerKey: 'common.email', render: (item) => item.email || '-' },
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
      <ModuleGuard moduleKey="COLLABORATORS">
      <div className="space-y-6">
        <PageHeader
          title={t('collaborators.title')}
          action={
            <GatedCreateButton
              resource="users"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('collaborators.createCollaborator')}
            </GatedCreateButton>
          }
        />

        <FilterPanel
          extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
          fields={[
            { key: 'name', labelKey: 'common.name', type: 'text' },
            {
              key: 'subtype',
              labelKey: 'collaborators.type',
              type: 'select',
              options: [
                { value: 'VIGILANT', label: t('collaborators.vigilant') },
                { value: 'SUPERVISOR', label: t('collaborators.supervisor') },
              ],
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
          }}
          onClear={() => {
            clearFilters();
            setActiveFilters({ name: '', status: 'ACTIVE', subtype: '' });
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

        <CollaboratorFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          collaborator={editing}
        />
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(undefined)}
          title={t('collaborators.deleteConfirm')}
          description={
            deleteTarget
              ? `${deleteTarget.firstName ?? ''} ${deleteTarget.lastName ?? ''}`.trim()
              : ''
          }
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
          isLoading={deleteMutation.isPending}
        />
      </div>
      </ModuleGuard>
    </RoleGuard>
  );
}
