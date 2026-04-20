'use client';

import { useEffect, useMemo } from 'react';
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
import { isSuperAdminMaster, isManagerOrAbove } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';
import { useUserScope } from '@/hooks/use-user-scope';

/**
 * Pull `{ _id, name }` out of a session field that can be a populated Company
 * object, a bare id string, or missing entirely. Returns null when we can't
 * form a useful option.
 */
function extractSessionOption(v: unknown): { _id: string; name: string } | null {
  if (!v) return null;
  if (typeof v === 'object' && v !== null && '_id' in v) {
    const obj = v as { _id?: unknown; name?: unknown };
    const id = typeof obj._id === 'string' ? obj._id : '';
    const name = typeof obj.name === 'string' ? obj.name : id;
    return id ? { _id: id, name: name || id } : null;
  }
  return null;
}

/** Prepend `preferred` to `list` when missing - keeps React keys stable. */
function mergeSessionOption<T extends { _id: string; name: string }>(
  list: T[],
  preferred: { _id: string; name: string } | null,
): Array<{ _id: string; name: string }> {
  if (!preferred) return list;
  if (list.some((item) => item._id === preferred._id)) return list;
  return [preferred, ...list];
}

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
  /**
   * Shrink labels + select height so the filters pack more per row.
   * Opt-in: legacy pages stay at the default density. Reports pages
   * enable this so their dense 6-column filter grid can fit hierarchy
   * + dates + actions on a single desktop row.
   */
  compact?: boolean;
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
  compact = false,
}: HierarchyFiltersProps) {
  const labelClass = compact
    ? 'text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1 block'
    : 'text-xs font-medium text-text-secondary mb-1.5 block';
  const triggerClass = compact ? 'h-9 px-3 text-sm' : undefined;
  const t = useTranslations();
  const { userSubtype, user: sessionUser } = useAuth();
  const scope = useUserScope();

  // Per-role visibility contract (mirrors the legacy shieldgo-admin-web
  // rules):
  //   SUPER_ADMIN_MASTER  → picks Account + Client + Site freely
  //   ADMIN_MASTER/ADMIN  → locked to session account; picks Client + Site
  //   MANAGER             → locked to account + picks Client + Site
  //   OPERATOR            → locked to account; can still switch Client/Site
  //                         inside it (some ops cover multiple clients)
  //   AUDITOR             → locked to account+client; picks Site only
  //
  // Account dropdown is the only one that's role-gated here - the Client
  // and Site dropdowns are controlled by the parent via showClient/showSite
  // props, and by the user's own selection.
  const canSelectAccount = isSuperAdminMaster(userSubtype);
  const isAuditor = userSubtype === 'AUDITOR';
  const canSelectClient = showClient && !isAuditor;
  const canSelectSite = showSite;

  // Resolve the effective account to scope Client/Site lookups by. SAM
  // uses whatever they've picked in the account dropdown; everyone else
  // is forced to their session account (server-side guards would block
  // cross-tenant lookups anyway, but we do it here too so the UI never
  // even fires those requests).
  const effectiveAccount = canSelectAccount ? value.account : scope.accountId;
  const effectiveClientForSites =
    value.client || (isManagerOrAbove(userSubtype) ? undefined : scope.clientId);

  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(effectiveAccount || undefined);
  const sitesLookup = useSitesLookup(
    effectiveClientForSites || undefined,
    effectiveAccount || undefined,
  );

  // Merge the session's own hierarchy (account/client/site) as a fallback
  // option. Reason: for non-SUPER_ADMIN roles the backend
  // `/api/company/filter/v1/` endpoint can return an empty list - either
  // because the api-gateway auto-scopes too aggressively or because the
  // user doesn't have permission to list siblings. In that case the
  // dropdown would be empty and the user couldn't even pick their own
  // scope. Merging the session object guarantees at least one entry so
  // the filter remains usable.
  const sessionAccount = useMemo(() => extractSessionOption(sessionUser?.account), [sessionUser?.account]);
  const sessionClient = useMemo(() => extractSessionOption(sessionUser?.client), [sessionUser?.client]);
  const sessionSite = useMemo(() => extractSessionOption(sessionUser?.site), [sessionUser?.site]);

  const accountOptions = mergeSessionOption(accountsLookup.data?.results ?? [], sessionAccount);
  const clientOptions = mergeSessionOption(clientsLookup.data?.results ?? [], sessionClient);
  const siteOptions = mergeSessionOption(sitesLookup.data?.results ?? [], sessionSite);

  // Auto-clear child filters when parent changes to an empty/different value
  useEffect(() => {
    // If account changes, wipe client/site; handled in the onValueChange below.
  }, [value.account, value.client]);

  return (
    <>
      {canSelectAccount && (
        <div>
          <label className={labelClass}>
            {t('common.account')}
          </label>
          <Select
            value={value.account || '__all__'}
            onValueChange={(val) => {
              const account = val === '__all__' ? '' : val;
              onChange({ account, client: '', site: '' });
            }}
          >
            <SelectTrigger className={triggerClass}>
              <SelectValue placeholder={t('common.selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('common.all')}</SelectItem>
              {accountOptions.map((a) => (
                <SelectItem key={a._id} value={a._id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {canSelectClient && (
        <div>
          <label className={labelClass}>
            {t('common.client')}
          </label>
          <Select
            value={value.client || '__all__'}
            onValueChange={(val) => {
              const client = val === '__all__' ? '' : val;
              onChange({ ...value, client, site: '' });
            }}
          >
            <SelectTrigger className={triggerClass}>
              <SelectValue placeholder={t('common.selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('common.all')}</SelectItem>
              {clientOptions.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {canSelectSite && (
        <div>
          <label className={labelClass}>
            {t('common.site')}
          </label>
          <Select
            value={value.site || '__all__'}
            onValueChange={(val) => {
              const site = val === '__all__' ? '' : val;
              onChange({ ...value, site });
            }}
          >
            <SelectTrigger className={triggerClass}>
              <SelectValue placeholder={t('common.selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('common.all')}</SelectItem>
              {siteOptions.map((s) => (
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
