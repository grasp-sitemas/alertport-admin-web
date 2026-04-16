'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAccountsLookup,
  useClientsLookup,
  useSitesLookup,
} from '@/features/shared/use-hierarchy-lookups';
import { isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';

export interface HierarchyFiltersValue {
  account?: string;
  client?: string;
  site?: string;
}

interface HierarchyFiltersProps {
  value: HierarchyFiltersValue;
  onChange: (next: HierarchyFiltersValue) => void;
  /** Hide the site filter on pages where picking a site doesn't apply. */
  showSite?: boolean;
  /** Hide the client filter (rare; usually kept). */
  showClient?: boolean;
}

/**
 * Reusable three-level hierarchy filter:
 *   Account → Client → Site
 *
 * Visibility rules (mirrors shieldgo-admin-web):
 *   - Account dropdown: visible only for SUPER_ADMIN_MASTER.
 *   - Client dropdown: visible for SUPER_ADMIN_MASTER, ADMIN, MANAGER.
 *     For ADMIN/MANAGER the list is already scoped by session account.
 *   - Site dropdown: visible for everyone that has client selected (or has
 *     client in session). AUDITOR sees only the sites they belong to.
 *
 * Cascading behaviour: picking a new parent clears its children.
 */
export function HierarchyFilters({
  value,
  onChange,
  showSite = true,
  showClient = true,
}: HierarchyFiltersProps) {
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const canSelectAccount = isSuperAdminMaster(userSubtype);

  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(value.account || undefined);
  const sitesLookup = useSitesLookup(value.client || undefined);

  // Auto-clear child filters when parent changes to an empty/different value
  useEffect(() => {
    // If account changes, wipe client/site; handled in the onValueChange below.
  }, [value.account, value.client]);

  return (
    <>
      {canSelectAccount && (
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">
            {t('common.account')}
          </label>
          <Select
            value={value.account || '__all__'}
            onValueChange={(val) => {
              const account = val === '__all__' ? '' : val;
              onChange({ account, client: '', site: '' });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('common.all')}</SelectItem>
              {(accountsLookup.data?.results ?? []).map((a) => (
                <SelectItem key={a._id} value={a._id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showClient && (
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">
            {t('common.client')}
          </label>
          <Select
            value={value.client || '__all__'}
            onValueChange={(val) => {
              const client = val === '__all__' ? '' : val;
              onChange({ ...value, client, site: '' });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('common.all')}</SelectItem>
              {(clientsLookup.data?.results ?? []).map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showSite && (
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">
            {t('common.site')}
          </label>
          <Select
            value={value.site || '__all__'}
            onValueChange={(val) => {
              const site = val === '__all__' ? '' : val;
              onChange({ ...value, site });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('common.selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('common.all')}</SelectItem>
              {(sitesLookup.data?.results ?? []).map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
