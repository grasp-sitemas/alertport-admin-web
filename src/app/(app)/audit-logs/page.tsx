'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { FilterPanel } from '@/components/shared/filter-panel';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { RoleGuard } from '@/components/shared/role-guard';
import { HierarchyFilters, type HierarchyFiltersValue } from '@/components/shared/hierarchy-filters';
import { ReportExportButton } from '@/features/reports/report-export-button';
import type { ExportPayload } from '@/features/reports/report-export';
import {
  useAccountsLookup,
  useClientsLookup,
  useSitesLookup,
} from '@/features/shared/use-hierarchy-lookups';
import { useAuth } from '@/hooks/use-auth';
import { isSuperAdminMaster } from '@/config/roles';
import { useFilters } from '@/hooks/use-filters';
import { usePagination } from '@/hooks/use-pagination';
import {
  auditLogService,
  type AuditAction,
  type AuditDomain,
  type AuditLogEntry,
} from '@/services/audit-log.service';

/**
 * Domains mirror the backend enum. Kept in sync with
 * ms-company/controllers/ctr-audit-log.js DOMAINS.
 */
const DOMAIN_OPTIONS: { value: AuditDomain; labelKey: string }[] = [
  { value: 'USER', labelKey: 'auditLog.domains.USER' },
  { value: 'COLLABORATOR', labelKey: 'auditLog.domains.COLLABORATOR' },
  { value: 'CLIENT', labelKey: 'auditLog.domains.CLIENT' },
  { value: 'SITE', labelKey: 'auditLog.domains.SITE' },
  { value: 'EQUIPMENT', labelKey: 'auditLog.domains.EQUIPMENT' },
  { value: 'MODULES', labelKey: 'auditLog.domains.MODULES' },
  { value: 'ATTENDANCE', labelKey: 'auditLog.domains.ATTENDANCE' },
  { value: 'RECORDING', labelKey: 'auditLog.domains.RECORDING' },
  { value: 'COMPANY', labelKey: 'auditLog.domains.COMPANY' },
];

const ACTION_OPTIONS: { value: AuditAction; labelKey: string }[] = [
  { value: 'USER_CREATED', labelKey: 'auditLog.actions.USER_CREATED' },
  { value: 'USER_UPDATED', labelKey: 'auditLog.actions.USER_UPDATED' },
  { value: 'USER_ARCHIVED', labelKey: 'auditLog.actions.USER_ARCHIVED' },
  { value: 'COLLABORATOR_CREATED', labelKey: 'auditLog.actions.COLLABORATOR_CREATED' },
  { value: 'COLLABORATOR_UPDATED', labelKey: 'auditLog.actions.COLLABORATOR_UPDATED' },
  { value: 'COLLABORATOR_ARCHIVED', labelKey: 'auditLog.actions.COLLABORATOR_ARCHIVED' },
  { value: 'CLIENT_CREATED', labelKey: 'auditLog.actions.CLIENT_CREATED' },
  { value: 'CLIENT_UPDATED', labelKey: 'auditLog.actions.CLIENT_UPDATED' },
  { value: 'CLIENT_ARCHIVED', labelKey: 'auditLog.actions.CLIENT_ARCHIVED' },
  { value: 'SITE_CREATED', labelKey: 'auditLog.actions.SITE_CREATED' },
  { value: 'SITE_UPDATED', labelKey: 'auditLog.actions.SITE_UPDATED' },
  { value: 'SITE_ARCHIVED', labelKey: 'auditLog.actions.SITE_ARCHIVED' },
  { value: 'EQUIPMENT_CREATED', labelKey: 'auditLog.actions.EQUIPMENT_CREATED' },
  { value: 'EQUIPMENT_UPDATED', labelKey: 'auditLog.actions.EQUIPMENT_UPDATED' },
  { value: 'EQUIPMENT_ARCHIVED', labelKey: 'auditLog.actions.EQUIPMENT_ARCHIVED' },
  { value: 'MODULES_CHANGED', labelKey: 'auditLog.actions.MODULES_CHANGED' },
  { value: 'ATTENDANCE_OPENED', labelKey: 'auditLog.actions.ATTENDANCE_OPENED' },
  { value: 'ATTENDANCE_CLOSED', labelKey: 'auditLog.actions.ATTENDANCE_CLOSED' },
  { value: 'RECORDING_PLAYED', labelKey: 'auditLog.actions.RECORDING_PLAYED' },
  { value: 'COMPANY_UPDATED', labelKey: 'auditLog.actions.COMPANY_UPDATED' },
];

// Audit-log queries are capped at 30 days. The endpoint scans a large
// time-series collection and we don't want operators triggering long-
// running queries by accident. Mirrors the reports module limit.
const MAX_RANGE_DAYS = 30;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(startISO: string, endISO: string): number | null {
  const start = startISO ? Date.parse(startISO) : NaN;
  const end = endISO ? Date.parse(endISO) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.ceil((end - start) / MS_PER_DAY);
}

export default function AuditLogsPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN']}>
      <AuditLogsBody />
    </RoleGuard>
  );
}

function AuditLogsBody() {
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const showAccountColumn = isSuperAdminMaster(userSubtype);
  const pagination = usePagination({ initialPageSize: 50 });
  const { filters, setFilter, clearFilters, buildFilterParams } = useFilters({
    initialFilters: {
      action: '',
      domain: '',
      startDate: last7DaysISO(),
      endDate: '',
    },
  });
  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeFilters, setActiveFilters] = useState(filters);

  // Load lookups to resolve audit-log IDs → names. These hooks self-gate by
  // role (accounts only for SAM, clients only once an account is known).
  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(activeHierarchy.account);
  const sitesLookup = useSitesLookup(activeHierarchy.client, activeHierarchy.account);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accountsLookup.data?.results ?? []) map.set(a._id, a.name);
    return map;
  }, [accountsLookup.data]);
  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientsLookup.data?.results ?? []) map.set(c._id, c.name);
    return map;
  }, [clientsLookup.data]);
  const siteNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sitesLookup.data?.results ?? []) map.set(s._id, s.name);
    return map;
  }, [sitesLookup.data]);

  const queryParams = useMemo(
    () => ({
      ...buildFilterParams(pagination.paginationParams),
      ...Object.fromEntries(
        Object.entries(activeFilters).filter(([, v]) => !!v && v !== ''),
      ),
      ...(activeHierarchy.account ? { accountId: activeHierarchy.account } : {}),
      ...(activeHierarchy.client ? { clientId: activeHierarchy.client } : {}),
      ...(activeHierarchy.site ? { siteId: activeHierarchy.site } : {}),
    }),
    [activeFilters, activeHierarchy, buildFilterParams, pagination.paginationParams],
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => auditLogService.filter(queryParams as never),
    staleTime: 60 * 1000,
  });

  const results = data?.results ?? [];
  const totalCount = data?.totalCount ?? 0;

  const getExportPayload = useCallback((): ExportPayload<AuditLogEntry> | null => {
    if (results.length === 0) return null;
    const start = activeFilters.startDate;
    const end = activeFilters.endDate;
    return {
      fileName: 'audit_log',
      title: t('auditLog.title'),
      subtitle: start || end ? `${start || '…'} — ${end || t('auditLog.today')}` : undefined,
      generatedAt: new Date().toISOString(),
      columns: [
        { header: t('auditLog.at'), value: (r) => new Date(r.at) },
        { header: t('auditLog.actor'), value: (r) => r.actor?.name ?? '' },
        { header: t('common.email'), value: (r) => r.actor?.email ?? '' },
        {
          header: t('auditLog.action'),
          value: (r) => safeT(t, `auditLog.actions.${r.action}`, r.action),
        },
        {
          header: t('auditLog.domain'),
          value: (r) => safeT(t, `auditLog.domains.${r.domain}`, r.domain),
        },
        ...(showAccountColumn
          ? [
              {
                header: t('common.account'),
                value: (r: AuditLogEntry) =>
                  r.accountId ? (accountNameById.get(r.accountId) ?? r.accountId) : '',
              },
            ]
          : []),
        {
          header: t('common.client'),
          value: (r) => (r.clientId ? (clientNameById.get(r.clientId) ?? r.clientId) : ''),
        },
        {
          header: t('common.site'),
          value: (r) => (r.siteId ? (siteNameById.get(r.siteId) ?? r.siteId) : ''),
        },
        {
          header: t('auditLog.resource'),
          value: (r) => r.resourceLabel || r.resourceId || '',
        },
      ],
      rows: results,
    };
  }, [
    results,
    t,
    showAccountColumn,
    accountNameById,
    clientNameById,
    siteNameById,
    activeFilters.startDate,
    activeFilters.endDate,
  ]);

  if (totalCount !== pagination.totalCount) {
    pagination.setTotalCount(totalCount);
  }

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'at',
      headerKey: 'auditLog.at',
      render: (r) => new Date(r.at).toLocaleString(),
    },
    {
      key: 'actor',
      headerKey: 'auditLog.actor',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-white">{r.actor?.name ?? '-'}</p>
          <p className="truncate text-xs text-text-muted">{r.actor?.email ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'action',
      headerKey: 'auditLog.action',
      render: (r) => (
        <Badge variant={badgeVariantFor(r.action)}>
          {safeT(t, `auditLog.actions.${r.action}`, r.action)}
        </Badge>
      ),
    },
    {
      key: 'domain',
      headerKey: 'auditLog.domain',
      render: (r) => (
        <span className="text-xs text-text-muted">
          {safeT(t, `auditLog.domains.${r.domain}`, r.domain)}
        </span>
      ),
    },
    ...(showAccountColumn
      ? ([
          {
            key: 'account',
            headerKey: 'common.account',
            render: (r: AuditLogEntry) =>
              r.accountId ? (accountNameById.get(r.accountId) ?? shortId(r.accountId)) : '-',
          },
        ] as Column<AuditLogEntry>[])
      : []),
    {
      key: 'client',
      headerKey: 'common.client',
      render: (r) =>
        r.clientId ? (clientNameById.get(r.clientId) ?? shortId(r.clientId)) : '-',
    },
    {
      key: 'site',
      headerKey: 'common.site',
      render: (r) => (r.siteId ? (siteNameById.get(r.siteId) ?? shortId(r.siteId)) : '-'),
    },
    {
      key: 'resource',
      headerKey: 'auditLog.resource',
      render: (r) => (
        <span className="text-xs text-text-secondary">
          {r.resourceLabel || r.resourceId || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('auditLog.title')}
        description={t('auditLog.description')}
        action={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs text-text-muted">
              <History className="h-4 w-4" />
              {totalCount} {t('auditLog.entries')}
            </span>
            <ReportExportButton
              getPayload={getExportPayload}
              disabled={isLoading || results.length === 0}
            />
          </div>
        }
      />

      <FilterPanel
        extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
        fields={[
          { key: 'startDate', labelKey: 'common.startDate', type: 'date' },
          { key: 'endDate', labelKey: 'common.endDate', type: 'date' },
          {
            key: 'action',
            labelKey: 'auditLog.action',
            type: 'select',
            options: ACTION_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            })),
          },
          {
            key: 'domain',
            labelKey: 'auditLog.domain',
            type: 'select',
            options: DOMAIN_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            })),
          },
        ]}
        values={filters}
        onChange={setFilter}
        onSearch={() => {
          // Cap audit-log queries at MAX_RANGE_DAYS (30 days) so the
          // operator can't trigger a long-running scan by accident. End-
          // date is treated as "today" when blank, mirroring how the
          // backend evaluates the filter.
          const days = daysBetween(
            typeof filters.startDate === 'string' ? filters.startDate : '',
            typeof filters.endDate === 'string' ? filters.endDate : '',
          );
          if (days != null && days > MAX_RANGE_DAYS) {
            toast.error(
              t('auditLog.errors.rangeExceeded', { max: MAX_RANGE_DAYS, actual: days }),
            );
            return;
          }
          pagination.setPage(1);
          setActiveFilters(filters);
          setActiveHierarchy(hierarchy);
          refetch();
        }}
        onClear={() => {
          clearFilters();
          setActiveFilters({ action: '', domain: '', startDate: '', endDate: '' });
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
        emptyTitle={t('auditLog.empty')}
      />
    </div>
  );
}

function badgeVariantFor(action: AuditAction): 'success' | 'warning' | 'danger' | 'brand' | 'info' {
  if (action.endsWith('_ARCHIVED')) return 'danger';
  if (action.endsWith('_UPDATED')) return 'warning';
  if (action.endsWith('_CREATED')) return 'success';
  if (action === 'MODULES_CHANGED') return 'brand';
  return 'info';
}

/**
 * next-intl throws on missing keys, but server-emitted action/domain
 * enums may outpace the client messages file. Fall back to the raw
 * enum value so the page never crashes on an unknown code.
 */
function safeT(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  try {
    const out = t(key);
    if (!out || out === key) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

function last7DaysISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Fallback label when we don't have a populated name for an ObjectId.
 * Shows the last 6 chars — enough for humans to correlate visually
 * without dominating the column width.
 */
function shortId(id: string): string {
  if (!id) return '-';
  return id.length > 6 ? `…${id.slice(-6)}` : id;
}
