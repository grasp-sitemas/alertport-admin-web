'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Search, Building2, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { RoleGuard } from '@/components/shared/role-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useAccountsLookup } from '@/features/shared/use-hierarchy-lookups';
import {
  accountModulesService,
  type AccountModuleDefinition,
} from '@/services/account-modules.service';

/**
 * Manual per-account plan management, restricted to SUPER_ADMIN_MASTER.
 *
 * Flow:
 *   1. Pick an account (filter by name).
 *   2. The page fetches the current override map + merges it with the
 *      catalog defaults so every module shows up as a checkbox.
 *   3. Operator toggles checkboxes, clicks Save. The payload is the
 *      full module map (partial is allowed by the server but sending
 *      the whole thing keeps the UX predictable).
 */
export default function ModulesPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [accountQuery, setAccountQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [localModules, setLocalModules] = useState<Record<string, boolean>>({});

  const accountsLookup = useAccountsLookup();
  const accounts = useMemo(
    () => accountsLookup.data?.results ?? [],
    [accountsLookup.data],
  );

  const filteredAccounts = useMemo(() => {
    const q = accountQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.name?.toLowerCase().includes(q));
  }, [accounts, accountQuery]);

  const catalogQuery = useQuery({
    queryKey: ['account-modules', 'catalog'],
    queryFn: () => accountModulesService.getCatalog(),
    staleTime: 10 * 60 * 1000,
  });

  const stateQuery = useQuery({
    queryKey: ['account-modules', 'state', selectedAccountId],
    queryFn: () =>
      selectedAccountId ? accountModulesService.getByAccount(selectedAccountId) : null,
    enabled: !!selectedAccountId,
  });

  // Mirror server state into local toggles on every fetch so the
  // Save button starts out as a no-op and the form reflects reality.
  // Syncing derived UI state from fetched data - this is not a
  // cascading render, it's a one-time reset per query result.
  useEffect(() => {
    if (stateQuery.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalModules(stateQuery.data.modules);
    }
  }, [stateQuery.data]);

  const catalog: AccountModuleDefinition[] = useMemo(
    () => catalogQuery.data ?? [],
    [catalogQuery.data],
  );
  const grouped = useMemo(() => {
    const by: Record<string, AccountModuleDefinition[]> = {};
    for (const m of catalog) {
      by[m.category] = by[m.category] ?? [];
      by[m.category].push(m);
    }
    return by;
  }, [catalog]);

  const dirty = useMemo(() => {
    const base = stateQuery.data?.modules ?? {};
    return catalog.some(
      (m) =>
        (localModules[m.key] ?? m.defaultEnabled) !==
        (base[m.key] ?? m.defaultEnabled),
    );
  }, [localModules, stateQuery.data, catalog]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId) throw new Error('no-account');
      // Send every known key so the saved state is explicit.
      const payload: Record<string, boolean> = {};
      for (const m of catalog) {
        payload[m.key] = localModules[m.key] ?? m.defaultEnabled;
      }
      return accountModulesService.saveByAccount(selectedAccountId, payload);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        ['account-modules', 'state', selectedAccountId],
        result,
      );
      toast.success(t('modules.saveSuccess'));
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const toggle = (key: string) =>
    setLocalModules((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  const selectedAccount = accounts.find((a) => a._id === selectedAccountId);

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER']}>
      <div className="space-y-6">
        <PageHeader
          title={t('modules.title')}
          description={t('modules.description')}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          {/* ── Account picker ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-brand-500" />
                {t('modules.selectAccount')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  className="pl-9"
                  placeholder={t('modules.searchAccountPlaceholder')}
                  value={accountQuery}
                  onChange={(e) => setAccountQuery(e.target.value)}
                />
              </div>

              {accountsLookup.isLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : filteredAccounts.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-6">
                  {t('modules.noAccounts')}
                </p>
              ) : (
                <ul className="max-h-[520px] overflow-y-auto space-y-1">
                  {filteredAccounts.map((a) => {
                    const active = a._id === selectedAccountId;
                    return (
                      <li key={a._id}>
                        <button
                          type="button"
                          onClick={() => setSelectedAccountId(a._id)}
                          className={
                            'w-full text-left rounded-lg px-3 py-2 text-sm transition-colors border ' +
                            (active
                              ? 'bg-brand-600/15 text-white border-brand-600/30'
                              : 'border-transparent text-text-secondary hover:bg-white/[0.04] hover:text-white')
                          }
                        >
                          {a.name || '-'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Module list ───────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                  {selectedAccount?.name ?? t('modules.noSelection')}
                </span>
                {stateQuery.data?.updatedAt && (
                  <Badge variant="muted" className="text-[10px]">
                    {t('common.updatedAt')}:{' '}
                    {new Date(stateQuery.data.updatedAt).toLocaleString()}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedAccountId ? (
                <EmptyState
                  icon={Building2}
                  title={t('modules.emptyStateTitle')}
                  description={t('modules.emptyStateDescription')}
                />
              ) : stateQuery.isLoading || catalogQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : (
                <>
                  <div className="space-y-6">
                    {Object.keys(grouped).map((category) => (
                      <div key={category}>
                        <Label className="text-xs uppercase tracking-wider text-text-muted mb-2 block">
                          {t(`modules.categories.${category}`)}
                        </Label>
                        <ul className="space-y-1">
                          {grouped[category].map((m) => {
                            const checked = localModules[m.key] ?? m.defaultEnabled;
                            return (
                              <li key={m.key}>
                                <label className="w-full cursor-pointer flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.04] transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggle(m.key)}
                                    className="mt-1 h-4 w-4 accent-brand-500 cursor-pointer"
                                    aria-label={t(`modules.items.${m.key}.label`)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white">
                                      {t(`modules.items.${m.key}.label`)}
                                    </p>
                                    <p className="text-xs text-text-muted mt-0.5">
                                      {t(`modules.items.${m.key}.desc`)}
                                    </p>
                                  </div>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-6 border-t border-white/[0.06] mt-6">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setLocalModules(stateQuery.data?.modules ?? {})
                      }
                      disabled={!dirty || saveMutation.isPending}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => saveMutation.mutate()}
                      disabled={!dirty || saveMutation.isPending}
                    >
                      {saveMutation.isPending ? (
                        <Spinner size="sm" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {t('common.save')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
