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
import { StatusBadge, RoleBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RoleGuard } from '@/components/shared/role-guard';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { UserFormDialog } from '@/features/users/user-form-dialog';
import { GatedCreateButton } from '@/components/trial/gated-create-button';
import { usersService } from '@/services/users.service';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import type { User } from '@/types/api';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';

export default function UsersPage() {
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
    queryKey: ['users', queryParams],
    queryFn: () => usersService.filter(queryParams),
  });

  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;
  if (totalCount !== pagination.totalCount) pagination.setTotalCount(totalCount);

  const deleteMutation = useMutation({
    // Legacy deletes by email via DELETE /api/users/v1/{email} with full body
    mutationFn: (user: User) => usersService.delete(user.email, user as unknown as Record<string, unknown>),
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'user');
      toast.success(t('users.deleteSuccess'));
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const columns: Column<User>[] = [
    {
      key: 'name',
      headerKey: 'common.name',
      render: (item) => {
        const name =
          item.fullName ?? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
        return <p className="font-medium text-white">{name || '-'}</p>;
      },
    },
    { key: 'email', headerKey: 'common.email', render: (item) => item.email },
    {
      key: 'role',
      headerKey: 'users.role',
      render: (item) =>
        item.companyUser?.subtype ? <RoleBadge role={item.companyUser.subtype} /> : '-',
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
            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

  const handleSearch = () => {
    pagination.setPage(1);
    setActiveFilters(filters);
    setActiveHierarchy(hierarchy);
  };

  const handleClear = () => {
    clearFilters();
    setActiveFilters({ name: '', status: 'ACTIVE', subtype: '' });
    setHierarchy({});
    setActiveHierarchy({});
    pagination.setPage(1);
  };

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN']}>
      <div className="space-y-6">
        <PageHeader
          title={t('users.title')}
          action={
            <GatedCreateButton
              resource="users"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('users.createUser')}
            </GatedCreateButton>
          }
        />

        <FilterPanel
          extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
          fields={[
            { key: 'name', labelKey: 'common.name', type: 'text' },
            {
              key: 'subtype',
              labelKey: 'users.role',
              type: 'select',
              options: [
                { value: 'ADMIN', label: t('roles.admin') },
                { value: 'MANAGER', label: t('roles.manager') },
                { value: 'OPERATOR', label: t('roles.operator') },
                { value: 'AUDITOR', label: t('roles.auditor') },
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
          onRowClick={(item) => {
            setEditing(item);
            setFormOpen(true);
          }}
        />

        <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(undefined)}
          title={t('users.deleteConfirm')}
          description={`${deleteTarget?.firstName} ${deleteTarget?.lastName}`}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </RoleGuard>
  );
}
