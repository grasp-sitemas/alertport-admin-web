'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Archive, RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RoleGuard } from '@/components/shared/role-guard';
import { CompanyListFormDialog } from '@/features/company/company-form-dialog';
import { companyService } from '@/services/company.service';
import { usePagination } from '@/hooks/use-pagination';
import { useFilters } from '@/hooks/use-filters';
import type { Company } from '@/types/api';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';
import { maskPhoneBR } from '@/lib/br-masks';

type ToggleTarget = { company: Company; next: 'ACTIVE' | 'ARCHIVED' };

export default function CompaniesPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters: { name: '', status: 'ACTIVE' },
  });
  const [activeFilters, setActiveFilters] = useState(filters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | undefined>();
  const [toggleTarget, setToggleTarget] = useState<ToggleTarget | undefined>();

  const queryParams = {
    ...buildFilterParams(pagination.paginationParams),
    ...activeFilters,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['companies', 'accounts', queryParams],
    queryFn: () => companyService.filterAccounts(queryParams),
  });

  const results = data?.results || [];
  const totalCount = data?.totalCount || 0;
  if (totalCount !== pagination.totalCount) pagination.setTotalCount(totalCount);

  const archiveMutation = useMutation({
    mutationFn: (id: string) => companyService.delete(id),
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'account');
      toast.success(t('companies.archiveSuccess'));
      setToggleTarget(undefined);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const restoreMutation = useMutation({
    mutationFn: (company: Company) =>
      companyService.update(company._id, {
        name: company.name,
        type: 'ACCOUNT',
        status: 'ACTIVE',
      }),
    onSuccess: () => {
      invalidateHierarchyAfter(queryClient, 'account');
      toast.success(t('companies.restoreSuccess'));
      setToggleTarget(undefined);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const toggleBusy = archiveMutation.isPending || restoreMutation.isPending;

  const columns: Column<Company>[] = [
    {
      key: 'name',
      headerKey: 'common.name',
      render: (item) => (
        <div className="min-w-0">
          <p className="font-medium text-white truncate">{item.name}</p>
          {item.fantasyName && (
            <p className="text-xs text-text-muted truncate">{item.fantasyName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'document',
      headerKey: 'company.document',
      render: (item) => item.document || '-',
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
            aria-label={t('companies.editCompany')}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {item.status === 'ACTIVE' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:bg-red-500/10"
              onClick={(e) => {
                e.stopPropagation();
                setToggleTarget({ company: item, next: 'ARCHIVED' });
              }}
              aria-label={t('companies.archive')}
            >
              <Archive className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-400 hover:bg-green-500/10"
              onClick={(e) => {
                e.stopPropagation();
                setToggleTarget({ company: item, next: 'ACTIVE' });
              }}
              aria-label={t('companies.restore')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER']}>
      <div className="space-y-6">
        <PageHeader
          title={t('companies.title')}
          description={t('companies.description')}
          action={
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('companies.createCompany')}
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
          onSearch={() => {
            pagination.setPage(1);
            setActiveFilters(filters);
          }}
          onClear={() => {
            clearFilters();
            setActiveFilters({ name: '', status: 'ACTIVE' });
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

        <CompanyListFormDialog open={formOpen} onOpenChange={setFormOpen} company={editing} />

        <ConfirmDialog
          open={!!toggleTarget}
          onOpenChange={(open) => !open && setToggleTarget(undefined)}
          title={
            toggleTarget?.next === 'ARCHIVED'
              ? t('companies.archiveConfirm')
              : t('companies.restoreConfirm')
          }
          description={toggleTarget?.company.name || ''}
          onConfirm={() => {
            if (!toggleTarget) return;
            if (toggleTarget.next === 'ARCHIVED') {
              archiveMutation.mutate(toggleTarget.company._id);
            } else {
              restoreMutation.mutate(toggleTarget.company);
            }
          }}
          isLoading={toggleBusy}
        />
      </div>
    </RoleGuard>
  );
}
