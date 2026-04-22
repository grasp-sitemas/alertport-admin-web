/**
 * Entity-specific configuration builders for the generic
 * BulkImportDialog. Each builder returns a config keyed on a shared
 * `context` bag (session/current scope) so the caller can provide
 * sensible defaults without requiring every CSV row to repeat them.
 *
 * Design contract:
 *   - CSV columns are the exact names published to the user. Keep
 *     them stable - operators save their spreadsheets.
 *   - parseRow is called ONCE per row at preview time (no I/O).
 *     Validation lives here; a row with a bad value surfaces an
 *     inline error and is skipped by the import phase.
 *   - createRow is called once per valid row at import time. It
 *     throws on backend failure; the dialog captures the message
 *     and shows it next to the row.
 */

import type { TranslateFn } from '@/lib/i18n-types';
import { usersService, type AdminUserFormData, type CustomerUserFormData } from '@/services/users.service';
import { equipmentService } from '@/services/equipment.service';
import type { EquipmentFormData } from '@/types/api';
import type { BulkImportConfig } from './bulk-import-dialog';

// ─── Shared helpers ──────────────────────────────────────────────

function required(value: string | undefined): string {
  return (value ?? '').trim();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Heuristic: does this string look like a Mongo ObjectId?
 * 24 hex chars exactly. We use this to decide whether the CSV cell
 * is already a canonical id or a human-readable name that needs
 * resolution.
 */
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
function isObjectId(value: string): boolean {
  return OBJECT_ID_RE.test(value.trim());
}

/**
 * Case-insensitive name → _id lookup table. Built once per dialog
 * open from the result of filterAccounts / filterClients /
 * filterSites and handed into each parseRow through the
 * entity-specific context.
 *
 * `ambiguous` lists names that appeared more than once in the
 * resolver source. Resolving an ambiguous name returns null so the
 * operator gets "unresolvedName" with a hint to use the id instead
 * of silently picking whichever record happened to land first in
 * the paginated response.
 */
export interface NameResolver {
  /** Map key = name.toLowerCase().trim(); value = Mongo _id. */
  byName: Record<string, string>;
  /** Names that appeared more than once (set of lowercased names). */
  ambiguous: Set<string>;
  /** Whether the underlying page was capped (list may be incomplete). */
  truncated: boolean;
}

/**
 * Resolve a CSV cell that may be an id OR a human-readable name.
 * Returns the canonical id, or null if no match (caller decides
 * whether that's a validation error).
 *
 * - Empty value → null (caller treats as "omitted").
 * - Already-ObjectId → passthrough.
 * - Otherwise → case-insensitive lookup in the resolver map.
 */
function resolveId(
  value: string,
  resolver: NameResolver | undefined,
): string | null {
  const v = value.trim();
  if (!v) return null;
  if (isObjectId(v)) return v;
  if (!resolver) return null;
  const key = v.toLowerCase();
  // Ambiguous name - two records share it. Reject instead of
  // silently picking the first (which would send the row to the
  // wrong tenant/site depending on pagination order).
  if (resolver.ambiguous.has(key)) return null;
  const hit = resolver.byName[key];
  return hit ?? null;
}

/**
 * Produce a user-facing error message for a cell that looks like a
 * name but couldn't be resolved. Differs from "required missing"
 * because the operator typed *something*, and we want to hint that
 * the name didn't match any visible record.
 */
function unresolvedError(t: TranslateFn, fieldName: string): string {
  return `${fieldName}: ${t('bulkImport.validation.unresolvedName')}`;
}

/**
 * Builder for the resolver map. Accepts the `{ _id, name }` shape
 * used by every hierarchy lookup in the app (accounts, clients,
 * sites, equipment) and produces a case-insensitive lookup table.
 *
 * Duplicate names (two accounts called "Empresa X" under the same
 * scope) go into `ambiguous` so resolveId refuses to guess — the
 * operator gets an "unresolvedName" error and must use the id to
 * disambiguate.
 *
 * Callers SHOULD pass `truncated: true` when the underlying page
 * was capped (e.g. 500-row filter limit hit). A truncated resolver
 * warns the operator in the dialog that rare names may not resolve
 * even if they're spelled correctly.
 */
export function buildNameResolver(
  items: Array<{ _id: string; name?: string } | null | undefined> | undefined,
  options?: { truncated?: boolean },
): NameResolver {
  const byName: Record<string, string> = {};
  const ambiguous = new Set<string>();
  if (!items) return { byName, ambiguous, truncated: !!options?.truncated };
  for (const item of items) {
    if (!item || !item._id) continue;
    const name = (item.name || '').trim().toLowerCase();
    if (!name) continue;
    if (byName[name] && byName[name] !== String(item._id)) {
      ambiguous.add(name);
    } else {
      byName[name] = String(item._id);
    }
  }
  return { byName, ambiguous, truncated: !!options?.truncated };
}

// ─── Users (USER-COMPANY) ────────────────────────────────────────

const USER_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR']);

export interface UsersBulkContext {
  /** Optional fallback account id used when the CSV doesn't spell it out.
   *  Comes from the caller's current session or page filter. */
  fallbackAccountId?: string;
  /** name→id map for the `account` column (SAM only). */
  accountResolver?: NameResolver;
  /** name→id map for the `client` column. */
  clientResolver?: NameResolver;
  /** name→id map for the `site` column. */
  siteResolver?: NameResolver;
}

export function buildUsersBulkConfig(
  t: TranslateFn,
  context: UsersBulkContext,
): BulkImportConfig<AdminUserFormData> {
  return {
    title: t('bulkImport.users.title'),
    description: t('bulkImport.users.description'),
    templateFileName: 'alertport-usuarios-modelo.csv',
    templateHeaders: [
      'firstName',
      'lastName',
      'email',
      'role',
      'account',
      'client',
      'site',
      'username',
      'phone',
      'password',
    ],
    templateSample: {
      firstName: 'João',
      lastName: 'Silva',
      email: 'joao.silva@empresa.com',
      role: 'OPERATOR',
      account: 'ID_DA_CONTA',
      client: '',
      site: '',
      username: 'joao.silva',
      phone: '11999999999',
      password: '',
    },
    parseRow: (row) => {
      const firstName = required(row.firstName);
      const lastName = required(row.lastName);
      const email = required(row.email);
      const role = required(row.role).toUpperCase();

      // Resolve account: CSV may carry an id or a name. Fall back to
      // context (session account) when the cell is blank.
      const rawAccount = required(row.account);
      const account = rawAccount
        ? resolveId(rawAccount, context.accountResolver)
        : context.fallbackAccountId || null;
      const rawClient = required(row.client);
      const client = rawClient ? resolveId(rawClient, context.clientResolver) : null;
      const rawSite = required(row.site);
      const site = rawSite ? resolveId(rawSite, context.siteResolver) : null;

      if (!firstName) return { kind: 'error', message: `firstName: ${t('bulkImport.validation.required')}` };
      if (!lastName) return { kind: 'error', message: `lastName: ${t('bulkImport.validation.required')}` };
      if (!email) return { kind: 'error', message: `email: ${t('bulkImport.validation.required')}` };
      if (!isEmail(email)) return { kind: 'error', message: t('bulkImport.validation.invalidEmail') };
      if (!USER_ROLES.has(role)) return { kind: 'error', message: t('bulkImport.validation.invalidRole') };
      if (!account) {
        return {
          kind: 'error',
          message: rawAccount
            ? unresolvedError(t, 'account')
            : `account: ${t('bulkImport.validation.required')}`,
        };
      }
      if (rawClient && !client) return { kind: 'error', message: unresolvedError(t, 'client') };
      if (rawSite && !site) return { kind: 'error', message: unresolvedError(t, 'site') };

      const payload: AdminUserFormData = {
        firstName,
        lastName,
        email,
        username: required(row.username) || undefined,
        primaryPhone: row.phone ? normalizeDigits(row.phone) : undefined,
        password: required(row.password) || undefined,
        account,
        client: client || undefined,
        site: site || undefined,
        status: 'ACTIVE',
        companyUser: {
          subtype: role as 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'AUDITOR',
          status: 'ACTIVE',
        },
        type: 'USER-COMPANY',
      };
      return { kind: 'ok', payload };
    },
    createRow: (payload) => usersService.create(payload, null),
  };
}

// ─── Collaborators (USER-CUSTOMER) ───────────────────────────────

const COLLABORATOR_SUBTYPES = new Set(['VIGILANT', 'SUPERVISOR']);

export interface CollaboratorsBulkContext {
  fallbackAccountId?: string;
  accountResolver?: NameResolver;
  clientResolver?: NameResolver;
  siteResolver?: NameResolver;
}

export function buildCollaboratorsBulkConfig(
  t: TranslateFn,
  context: CollaboratorsBulkContext,
): BulkImportConfig<CustomerUserFormData> {
  return {
    title: t('bulkImport.collaborators.title'),
    description: t('bulkImport.collaborators.description'),
    templateFileName: 'alertport-colaboradores-modelo.csv',
    templateHeaders: [
      'firstName',
      'lastName',
      'email',
      'username',
      'subtype',
      'account',
      'client',
      'site',
      'phone',
      'employeeCode',
      'password',
    ],
    templateSample: {
      firstName: 'Maria',
      lastName: 'Souza',
      email: 'maria.souza@cliente.com',
      username: 'maria.souza',
      subtype: 'VIGILANT',
      account: 'ID_DA_CONTA',
      client: 'ID_DO_CLIENTE',
      site: 'ID_DO_SITE',
      phone: '11999999999',
      employeeCode: '12345',
      password: '',
    },
    parseRow: (row) => {
      const firstName = required(row.firstName);
      const lastName = required(row.lastName);
      const email = required(row.email);
      const username = required(row.username);
      const subtype = required(row.subtype).toUpperCase();

      const rawAccount = required(row.account);
      const account = rawAccount
        ? resolveId(rawAccount, context.accountResolver)
        : context.fallbackAccountId || null;
      const rawClient = required(row.client);
      const client = rawClient ? resolveId(rawClient, context.clientResolver) : null;
      const rawSite = required(row.site);
      const site = rawSite ? resolveId(rawSite, context.siteResolver) : null;

      if (!firstName) return { kind: 'error', message: `firstName: ${t('bulkImport.validation.required')}` };
      if (!lastName) return { kind: 'error', message: `lastName: ${t('bulkImport.validation.required')}` };
      if (!email) return { kind: 'error', message: `email: ${t('bulkImport.validation.required')}` };
      if (!isEmail(email)) return { kind: 'error', message: t('bulkImport.validation.invalidEmail') };
      if (!username) return { kind: 'error', message: `username: ${t('bulkImport.validation.required')}` };
      if (!COLLABORATOR_SUBTYPES.has(subtype)) {
        return { kind: 'error', message: t('bulkImport.validation.invalidSubtype') };
      }
      if (!account) {
        return {
          kind: 'error',
          message: rawAccount
            ? unresolvedError(t, 'account')
            : `account: ${t('bulkImport.validation.required')}`,
        };
      }
      if (!client) {
        return {
          kind: 'error',
          message: rawClient
            ? unresolvedError(t, 'client')
            : `client: ${t('bulkImport.validation.required')}`,
        };
      }
      if (!site) {
        return {
          kind: 'error',
          message: rawSite
            ? unresolvedError(t, 'site')
            : `site: ${t('bulkImport.validation.required')}`,
        };
      }

      const payload: CustomerUserFormData = {
        firstName,
        lastName,
        email,
        username,
        primaryPhone: row.phone ? normalizeDigits(row.phone) : undefined,
        password: required(row.password) || undefined,
        account,
        client,
        site,
        customerUser: {
          subtype: subtype as 'VIGILANT' | 'SUPERVISOR',
          status: 'ACTIVE',
          employeeCode: required(row.employeeCode) || undefined,
        },
        type: 'USER-CUSTOMER',
        status: 'ACTIVE',
      };
      return { kind: 'ok', payload };
    },
    createRow: (payload) => usersService.createCollaborator(payload, null),
  };
}

// ─── Equipment ───────────────────────────────────────────────────

export interface EquipmentBulkContext {
  fallbackAccountId?: string;
  accountResolver?: NameResolver;
  clientResolver?: NameResolver;
  siteResolver?: NameResolver;
}

export function buildEquipmentBulkConfig(
  t: TranslateFn,
  context: EquipmentBulkContext,
): BulkImportConfig<EquipmentFormData> {
  return {
    title: t('bulkImport.equipment.title'),
    description: t('bulkImport.equipment.description'),
    templateFileName: 'alertport-equipamentos-modelo.csv',
    templateHeaders: ['code', 'account', 'client', 'site', 'type', 'brand'],
    templateSample: {
      code: 'APT-001',
      account: 'ID_DA_CONTA',
      client: 'ID_DO_CLIENTE',
      site: 'ID_DO_SITE',
      type: '',
      brand: '',
    },
    parseRow: (row) => {
      const code = required(row.code);

      const rawAccount = required(row.account);
      const account = rawAccount
        ? resolveId(rawAccount, context.accountResolver)
        : context.fallbackAccountId || null;
      const rawClient = required(row.client);
      const client = rawClient ? resolveId(rawClient, context.clientResolver) : null;
      const rawSite = required(row.site);
      const site = rawSite ? resolveId(rawSite, context.siteResolver) : null;

      if (!code) return { kind: 'error', message: `code: ${t('bulkImport.validation.required')}` };
      if (!account) {
        return {
          kind: 'error',
          message: rawAccount
            ? unresolvedError(t, 'account')
            : `account: ${t('bulkImport.validation.required')}`,
        };
      }
      if (!client) {
        return {
          kind: 'error',
          message: rawClient
            ? unresolvedError(t, 'client')
            : `client: ${t('bulkImport.validation.required')}`,
        };
      }
      if (!site) {
        return {
          kind: 'error',
          message: rawSite
            ? unresolvedError(t, 'site')
            : `site: ${t('bulkImport.validation.required')}`,
        };
      }

      const payload: EquipmentFormData = {
        code,
        account,
        client,
        site,
        type: required(row.type) || undefined,
        brand: required(row.brand) || undefined,
        status: 'ACTIVE',
      };
      return { kind: 'ok', payload };
    },
    createRow: (payload) => equipmentService.create(payload),
  };
}
