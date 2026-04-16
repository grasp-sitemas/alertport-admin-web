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
import { UserFormDialog } from '@/features/users/user-form-dialog';
import { usersService } from '@/services/users.service';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import type { User } from '@/types/api';

export default function UsersPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters: { name: '', status: '' },
  });
  const [activeFilters, setActiveFilters] = useState(filters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<User | undefined>();

  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['users', queryParams],
    queryFn: () => usersService.filter(queryParams),
  });

  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;
  if (totalCount !== pagination.totalCount) pagination.setTotalCount(totalCount);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('users.deleteSuccess'));
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const columns: Column<User>[] = [
    {
      key: 'name',
      headerKey: 'common.name',
      render: (item) => (
        <div>
          <p className="font-medium text-white">
            {item.firstName} {item.lastName}
          </p>
        </div>
      ),
    },
    { key: 'email', headerKey: 'common.email', render: (item) => item.email },
    {
      key: 'role',
      headerKey: 'users.role',
      render: (item) =>
        item.companyUser?.subtype ? <RoleBadge role={item.companyUser.subtype} /> : '—',
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
  };

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN']}>
      <div className="space-y-6">
        <PageHeader
          title={t('users.title')}
          action={
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('users.createUser')}
            </Button>
          }
        />

        <FilterPanel
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
          onSearch={handleSearch}
          onClear={() => {
            clearFilters();
            setActiveFilters({});
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

        <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(undefined)}
          title={t('users.deleteConfirm')}
          description={`${deleteTarget?.firstName} ${deleteTarget?.lastName}`}
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </RoleGuard>
  );
}
