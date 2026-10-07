'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { RoleGuard } from '@/components/shared/role-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { extractId } from '@/lib/utils';
import { useAccountsLookup, useClientsLookup } from '@/features/shared/use-hierarchy-lookups';
import { companyService } from '@/services/company.service';
import { siteGroupsService, type SiteGroup } from '@/services/site-groups.service';

export default function SiteGroupsPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN']}>
      <SiteGroups />
    </RoleGuard>
  );
}

function SiteGroups() {
  const t = useTranslations();
  const { user, userSubtype } = useAuth();
  const cache = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState('');
  const account =
    userSubtype === 'SUPER_ADMIN_MASTER' ? selectedAccount : extractId(user?.account) || '';
  const [form, setForm] = useState<SiteGroup | null>(null);
  const accounts = useAccountsLookup();
  const clients = useClientsLookup(account);
  const groups = useQuery({
    queryKey: ['site-groups', account],
    queryFn: () => siteGroupsService.list(account),
    enabled: !!account,
  });
  const sites = useQuery({
    queryKey: ['group-sites', account],
    queryFn: () => companyService.filterSites({ account, status: 'ACTIVE', skip: 1, limit: 500 }),
    enabled: !!account,
  });
  const save = useMutation({
    mutationFn: (value: SiteGroup) => siteGroupsService.save(value),
    onSuccess: () => {
      setForm(null);
      cache.invalidateQueries({ queryKey: ['site-groups'] });
      toast.success(t('siteGroups.saved'));
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => siteGroupsService.archive(id),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['site-groups'] });
      toast.success(t('siteGroups.saved'));
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });
  const ids = (form?.sites || []).map(extractId).filter(Boolean);
  const labelClass = 'text-text-secondary block space-y-2 text-sm';
  const selectClass = 'bg-surface border-border w-full rounded-md border p-2';
  return (
    <div>
      <PageHeader
        title={t('siteGroups.title')}
        description={t('siteGroups.description')}
        action={
          <Button
            disabled={!account}
            onClick={() => setForm({ name: '', account, client: '', sites: [], status: 'ACTIVE' })}
          >
            {t('siteGroups.new')}
          </Button>
        }
      />
      {userSubtype === 'SUPER_ADMIN_MASTER' && (
        <label className={labelClass}>
          {t('common.account')}
          <select
            aria-label={t('common.account')}
            className={selectClass}
            value={account}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              setForm(null);
            }}
          >
            <option value="">{t('common.selectOption')}</option>
            {accounts.data?.results.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {(groups.isError || sites.isError) && <p role="alert">{t('notifications.errorOccurred')}</p>}
      {form && (
        <form
          className="border-border my-6 space-y-4 rounded-lg border p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ ...form, account, sites: ids as string[] });
          }}
        >
          <label className={labelClass}>
            {t('common.name')}
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            {t('common.client')}
            <select
              required
              className={selectClass}
              value={extractId(form.client) || ''}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
            >
              <option value="">{t('common.selectOption')}</option>
              {clients.data?.results.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2">{t('siteGroups.sites')}</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {sites.data?.results.map((site) => (
                <label key={site._id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ids.includes(site._id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sites: e.target.checked
                          ? ([...ids, site._id] as string[])
                          : (ids.filter((id) => id !== site._id) as string[]),
                      })
                    }
                  />
                  {site.name}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-text-secondary text-sm">{t('siteGroups.operatorHint')}</p>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                save.isPending ||
                !form.name.trim() ||
                !extractId(form.client) ||
                !ids.length ||
                sites.isError
              }
            >
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setForm(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}
      <div className="mt-6 space-y-3">
        {groups.data?.map((group) => (
          <div
            key={group._id}
            className="border-border flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <p className="font-medium">{group.name}</p>
              <p className="text-text-secondary text-sm">
                {group.sites.length} {t('siteGroups.sites')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setForm({ ...group })}>
                {t('common.edit')}
              </Button>
              <Button
                variant="outline"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(t('siteGroups.archiveConfirm'))) remove.mutate(group._id!);
                }}
              >
                {t('siteGroups.archive')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
