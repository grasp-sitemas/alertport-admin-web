/**
 * Contract tests for the SUPER_ADMIN_MASTER modules management flow.
 *
 * Locks three things that silently drift if we don't watch them:
 *
 *  1. Service URLs — the frontend must hit the exact backend routes
 *     added on ms-company + api-gateway.
 *  2. i18n parity — every catalog key has localized `label` + `desc`
 *     in every locale, and `sidebar.modules` is present everywhere.
 *  3. Navigation scope — `sidebar.modules` is guarded to
 *     SUPER_ADMIN_MASTER only. If someone widens the roles array by
 *     accident, this test catches it before review.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountModulesService } from '@/services/account-modules.service';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import { navigation } from '@/config/navigation';
import ptMessages from '@/messages/pt.json';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import jaMessages from '@/messages/ja.json';
import zhMessages from '@/messages/zh.json';

// Canonical catalog mirrors the server constant in
// shieldgo-microservices/ms-company/controllers/ctr-account-modules.js.
// Keep in sync whenever a module is added.
const CATALOG_KEYS = [
  'MONITOR',
  'SCHEDULING',
  'OCCURRENCES',
  'TIME_ENTRIES',
  'CALL_NORMAL',
  'CALL_SILENT',
  'RECORDINGS',
  'REPORTS',
  'CLIENTS',
  'SITES',
  'EQUIPMENT',
  'COLLABORATORS',
  'USERS',
  'COMPANY_SETTINGS',
] as const;

describe('accountModulesService', () => {
  let get: ReturnType<typeof vi.spyOn>;
  let put: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    get = vi.spyOn(apiClient, 'get');
    put = vi.spyOn(apiClient, 'put');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getCatalog GETs /api/company/modules/catalog/v1/', async () => {
    get.mockResolvedValue({
      data: { status: 200, result: { catalog: [] } },
    } as never);
    await accountModulesService.getCatalog();
    expect(get.mock.calls[0][0]).toBe(endpoints.accountModulesCatalog);
    expect(endpoints.accountModulesCatalog).toMatch(/\/api\/company\/modules\/catalog\/v1\/$/);
  });

  it('getCatalog unwraps result.catalog and returns [] when missing', async () => {
    get.mockResolvedValue({ data: { status: 200 } } as never);
    const out = await accountModulesService.getCatalog();
    expect(out).toEqual([]);
  });

  it('getByAccount GETs /api/company/modules/by-account/:id/v1/', async () => {
    get.mockResolvedValue({
      data: { status: 200, result: { accountId: 'A1', modules: {}, updatedAt: null, updatedBy: null } },
    } as never);
    await accountModulesService.getByAccount('64b9a1f1f1f1f1f1f1f1f1f1');
    expect(get.mock.calls[0][0]).toBe(
      endpoints.accountModulesByAccount('64b9a1f1f1f1f1f1f1f1f1f1'),
    );
    expect(get.mock.calls[0][1]).toEqual({ retry: false });
    expect(get.mock.calls[0][0]).toMatch(
      /\/api\/company\/modules\/by-account\/64b9a1f1f1f1f1f1f1f1f1f1\/v1\/$/,
    );
  });

  it('saveByAccount PUTs the modules map', async () => {
    put.mockResolvedValue({
      data: { status: 200, result: { accountId: 'A1', modules: { MONITOR: false }, updatedAt: null, updatedBy: null } },
    } as never);
    await accountModulesService.saveByAccount('A1', { MONITOR: false });
    expect(put.mock.calls[0][0]).toBe(endpoints.accountModulesByAccount('A1'));
    expect(put.mock.calls[0][1]).toEqual({ modules: { MONITOR: false } });
  });

  it('saveByAccount echoes the payload when server omits result', async () => {
    put.mockResolvedValue({ data: { status: 200 } } as never);
    const out = await accountModulesService.saveByAccount('A1', { MONITOR: true });
    expect(out.accountId).toBe('A1');
    expect(out.modules.MONITOR).toBe(true);
  });
});

describe('account modules i18n parity', () => {
  const locales = {
    pt: ptMessages,
    en: enMessages,
    es: esMessages,
    ja: jaMessages,
    zh: zhMessages,
  };

  function resolve(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let node: unknown = obj;
    for (const p of parts) {
      if (!node || typeof node !== 'object') return undefined;
      node = (node as Record<string, unknown>)[p];
    }
    return node;
  }

  it('sidebar.modules resolves to a non-empty string in every locale', () => {
    for (const [lang, bundle] of Object.entries(locales)) {
      const label = resolve(bundle, 'sidebar.modules');
      expect(typeof label === 'string' && label.length > 0).toBe(true);
      if (typeof label !== 'string') throw new Error(`${lang} missing sidebar.modules`);
    }
  });

  it('every catalog key has modules.items.<KEY>.label + .desc in every locale', () => {
    const missing: string[] = [];
    for (const key of CATALOG_KEYS) {
      for (const [lang, bundle] of Object.entries(locales)) {
        const label = resolve(bundle, `modules.items.${key}.label`);
        const desc = resolve(bundle, `modules.items.${key}.desc`);
        if (typeof label !== 'string' || !label.trim()) missing.push(`${lang}:${key}.label`);
        if (typeof desc !== 'string' || !desc.trim()) missing.push(`${lang}:${key}.desc`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('page-level strings (title, description, save success, empty state) resolve everywhere', () => {
    const requiredKeys = [
      'modules.title',
      'modules.description',
      'modules.selectAccount',
      'modules.searchAccountPlaceholder',
      'modules.noAccounts',
      'modules.emptyStateTitle',
      'modules.emptyStateDescription',
      'modules.saveSuccess',
    ];
    const missing: string[] = [];
    for (const k of requiredKeys) {
      for (const [lang, bundle] of Object.entries(locales)) {
        const val = resolve(bundle, k);
        if (typeof val !== 'string' || !val.trim()) missing.push(`${lang}:${k}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('no em-dash (U+2014) inside the modules block of any locale', () => {
    const offenders: string[] = [];
    for (const [lang, bundle] of Object.entries(locales)) {
      const block = JSON.stringify(resolve(bundle, 'modules') ?? {});
      if (block.includes('\u2014')) offenders.push(lang);
    }
    expect(offenders).toEqual([]);
  });
});

describe('sidebar.modules nav entry', () => {
  it('is restricted to SUPER_ADMIN_MASTER only', () => {
    const companySection = navigation.find((s) => s.titleKey === 'sidebar.company');
    if (!companySection) throw new Error('company section missing');
    const modulesEntry = companySection.items.find(
      (i) => i.titleKey === 'sidebar.modules',
    );
    expect(modulesEntry).toBeDefined();
    expect(modulesEntry?.roles).toEqual(['SUPER_ADMIN_MASTER']);
    expect(modulesEntry?.href).toBe('/modules');
  });
});
