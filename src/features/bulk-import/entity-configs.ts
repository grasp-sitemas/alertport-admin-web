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

// ─── Users (USER-COMPANY) ────────────────────────────────────────

const USER_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR']);

export interface UsersBulkContext {
  /** Optional fallback account id used when the CSV doesn't spell it out.
   *  Comes from the caller's current session or page filter. */
  fallbackAccountId?: string;
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
      const account = required(row.account) || context.fallbackAccountId || '';

      if (!firstName) return { kind: 'error', message: `firstName: ${t('bulkImport.validation.required')}` };
      if (!lastName) return { kind: 'error', message: `lastName: ${t('bulkImport.validation.required')}` };
      if (!email) return { kind: 'error', message: `email: ${t('bulkImport.validation.required')}` };
      if (!isEmail(email)) return { kind: 'error', message: t('bulkImport.validation.invalidEmail') };
      if (!USER_ROLES.has(role)) return { kind: 'error', message: t('bulkImport.validation.invalidRole') };
      if (!account) return { kind: 'error', message: `account: ${t('bulkImport.validation.required')}` };

      const payload: AdminUserFormData = {
        firstName,
        lastName,
        email,
        username: required(row.username) || undefined,
        primaryPhone: row.phone ? normalizeDigits(row.phone) : undefined,
        password: required(row.password) || undefined,
        account,
        client: required(row.client) || undefined,
        site: required(row.site) || undefined,
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
      const account = required(row.account) || context.fallbackAccountId || '';
      const client = required(row.client);
      const site = required(row.site);

      if (!firstName) return { kind: 'error', message: `firstName: ${t('bulkImport.validation.required')}` };
      if (!lastName) return { kind: 'error', message: `lastName: ${t('bulkImport.validation.required')}` };
      if (!email) return { kind: 'error', message: `email: ${t('bulkImport.validation.required')}` };
      if (!isEmail(email)) return { kind: 'error', message: t('bulkImport.validation.invalidEmail') };
      if (!username) return { kind: 'error', message: `username: ${t('bulkImport.validation.required')}` };
      if (!COLLABORATOR_SUBTYPES.has(subtype)) {
        return { kind: 'error', message: t('bulkImport.validation.invalidSubtype') };
      }
      if (!account) return { kind: 'error', message: `account: ${t('bulkImport.validation.required')}` };
      if (!client) return { kind: 'error', message: `client: ${t('bulkImport.validation.required')}` };
      if (!site) return { kind: 'error', message: `site: ${t('bulkImport.validation.required')}` };

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
      const account = required(row.account) || context.fallbackAccountId || '';
      const client = required(row.client);
      const site = required(row.site);

      if (!code) return { kind: 'error', message: `code: ${t('bulkImport.validation.required')}` };
      if (!account) return { kind: 'error', message: `account: ${t('bulkImport.validation.required')}` };
      if (!client) return { kind: 'error', message: `client: ${t('bulkImport.validation.required')}` };
      if (!site) return { kind: 'error', message: `site: ${t('bulkImport.validation.required')}` };

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
