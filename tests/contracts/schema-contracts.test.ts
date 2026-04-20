/* eslint-disable @typescript-eslint/no-explicit-any --
   Fixtures mirror the shape the API actually returns, which is typed as
   `any` on purpose: the schema under test is the contract - not the fixture
   type. Mapping each form's `reset(defaults)` manually with `unknown` casts
   at every access would add noise without catching any more bugs. */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { userFormSchema, DEFAULT_USER_VALUES } from '@/features/users/schemas';
import {
  collaboratorFormSchema,
  DEFAULT_COLLABORATOR_VALUES,
} from '@/features/collaborators/schemas';
import { clientFormSchema, DEFAULT_CLIENT_VALUES } from '@/features/clients/schemas';
import { siteFormSchema, DEFAULT_SITE_VALUES } from '@/features/sites/schemas';
import { companyFormSchema } from '@/features/company/schemas';
import {
  equipmentFormSchema,
  DEFAULT_EQUIPMENT_VALUES,
} from '@/features/equipment/schemas';

/**
 * Schema contract tests.
 *
 * Each form in the app uses a zod schema to validate the payload before it
 * is submitted. The initial form state is hydrated from a real API response.
 * If the API returns a shape that the schema can't accept, `handleSubmit`
 * fails silently - the user clicks Save and nothing happens.
 *
 * These tests lock that contract: for every edit form, every fixture row
 * must pass `schema.safeParse(toFormValues(apiRow))`. The fixtures are
 * checked into `tests/fixtures/api/` and can be refreshed from live HML via
 * `npm run test:fixtures:snapshot`.
 *
 * When an API change breaks the contract, this test fails in CI before the
 * bug can reach users.
 */

function loadFixture(name: string): any {
  const file = resolve(__dirname, '..', 'fixtures', 'api', `${name}.json`);
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function getIdOrEmpty(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && '_id' in v) {
    const id = (v as { _id?: unknown })._id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

describe('schema contracts - every fixture row must edit-load without zod errors', () => {
  describe('userFormSchema (admin users /users)', () => {
    const fixture = loadFixture('companyuser-search');
    const rows = fixture.results.filter(
      (r: any) =>
        r.type === 'USER-COMPANY' &&
        // Only roles the edit form actually supports. SUPER_ADMIN_MASTER
        // isn't editable via /users - it's the whitelabel owner and has no
        // form entry for its role.
        ['ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR'].includes(r.companyUser?.subtype),
    );

    it.each(rows as any[])('accepts $firstName $lastName ($_id)', (row: any) => {
      const values = {
        ...DEFAULT_USER_VALUES,
        _id: row._id,
        firstName: row.firstName ?? '',
        lastName: row.lastName ?? '',
        email: row.email ?? '',
        oldEmail: row.email ?? '',
        username: row.username ?? '',
        oldUsername: row.username ?? '',
        primaryPhone: row.primaryPhone ?? '',
        photoURL: row.photoURL ?? '',
        account: getIdOrEmpty(row.account),
        client: getIdOrEmpty(row.client),
        site: getIdOrEmpty(row.site),
        status: row.status ?? 'ACTIVE',
        companyUser: {
          subtype: row.companyUser?.subtype ?? 'OPERATOR',
          status: row.companyUser?.status ?? 'ACTIVE',
        },
        address: row.address
          ? {
              cep: row.address.cep ?? '',
              address: row.address.address ?? '',
              number: row.address.number ?? '',
              complement: row.address.complement ?? '',
              neighborhood: row.address.neighborhood ?? '',
              city: row.address.city ?? '',
              state: row.address.state ?? '',
              country: row.address.country ?? 'BR',
              ibge: row.address.ibge ?? '',
              gia: row.address.gia ?? '',
              name: row.address.name ?? 'MAIN',
            }
          : DEFAULT_USER_VALUES.address,
      };
      const result = userFormSchema.safeParse(values);
      if (!result.success) console.error(result.error.format());
      expect(result.success).toBe(true);
    });
  });

  describe('collaboratorFormSchema (customer users /collaborators)', () => {
    const fixture = loadFixture('customeruser-search');
    const rows = fixture.results.filter((r: any) => r.type === 'USER-CUSTOMER');

    it.each(rows as any[])('accepts $firstName $lastName ($_id)', (row: any) => {
      const values = {
        ...DEFAULT_COLLABORATOR_VALUES,
        _id: row._id,
        firstName: row.firstName ?? '',
        lastName: row.lastName ?? '',
        email: row.email ?? '',
        oldEmail: row.email ?? '',
        username: row.username ?? '',
        oldUsername: row.username ?? '',
        primaryPhone: row.primaryPhone ?? '',
        photoURL: row.photoURL ?? '',
        account: getIdOrEmpty(row.account),
        client: getIdOrEmpty(row.client),
        site: getIdOrEmpty(row.site),
        customerUser: {
          subtype: row.customerUser?.subtype ?? 'VIGILANT',
          status: row.customerUser?.status ?? row.status ?? 'ACTIVE',
          employeeCode: row.customerUser?.employeeCode,
        },
        address: row.address
          ? {
              cep: row.address.cep ?? '',
              address: row.address.address ?? '',
              number: row.address.number ?? '',
              complement: row.address.complement ?? '',
              neighborhood: row.address.neighborhood ?? '',
              city: row.address.city ?? '',
              state: row.address.state ?? '',
              name: row.address.name ?? 'MAIN',
            }
          : DEFAULT_COLLABORATOR_VALUES.address,
        type: 'USER-CUSTOMER' as const,
        status: row.status ?? 'ACTIVE',
      };
      const result = collaboratorFormSchema.safeParse(values);
      if (!result.success) console.error(result.error.format());
      expect(result.success).toBe(true);
    });
  });

  describe('clientFormSchema (/clients)', () => {
    const fixture = loadFixture('company-filter');
    const rows = fixture.results.filter((r: any) => r.type === 'CLIENT');

    it.each(rows as any[])('accepts $name ($_id)', (row: any) => {
      const values = {
        ...DEFAULT_CLIENT_VALUES,
        _id: row._id,
        name: row.name ?? '',
        email: row.email ?? '',
        primaryPhone: (row.primaryPhone ?? '').replace(/\D/g, ''),
        owner: row.owner ?? '',
        account: getIdOrEmpty(row.account),
        type: 'CLIENT' as const,
        status: row.status ?? 'ACTIVE',
      };
      const result = clientFormSchema.safeParse(values);
      if (!result.success) console.error(result.error.format());
      expect(result.success).toBe(true);
    });
  });

  describe('siteFormSchema (/sites)', () => {
    const fixture = loadFixture('company-filter');
    const rows = fixture.results.filter((r: any) => r.type === 'SITE');

    it.each(rows as any[])('accepts $name ($_id)', (row: any) => {
      const values = {
        ...DEFAULT_SITE_VALUES,
        _id: row._id,
        name: row.name ?? '',
        account: getIdOrEmpty(row.account),
        client: getIdOrEmpty(row.client),
        primaryPhone: (row.primaryPhone ?? '').replace(/\D/g, ''),
        owner: row.owner ?? '',
        address: row.address
          ? {
              cep: row.address.cep ?? '',
              address: row.address.address ?? '',
              number: row.address.number ?? '',
              complement: row.address.complement ?? '',
              neighborhood: row.address.neighborhood ?? '',
              city: row.address.city ?? '',
              state: row.address.state ?? '',
              country: row.address.country ?? 'BR',
              ibge: row.address.ibge ?? '',
              gia: row.address.gia ?? '',
              name: row.address.name ?? 'MAIN',
            }
          : DEFAULT_SITE_VALUES.address,
        type: 'SITE' as const,
        status: row.status ?? 'ACTIVE',
      };
      const result = siteFormSchema.safeParse(values);
      if (!result.success) console.error(result.error.format());
      expect(result.success).toBe(true);
    });
  });

  describe('companyFormSchema (/company)', () => {
    const fixture = loadFixture('me');
    // The company page picks one entity from the /me response based on the
    // user's role. For SUPER_ADMIN_MASTER that's the whitelabel `company`.
    const company = fixture.result.company ?? fixture.result.account;

    it(`accepts the logged-in user's company (${company?.name})`, () => {
      const extras = company as { secondaryPhone?: string; timezone?: string };
      const values = {
        _id: company._id,
        name: company.name ?? '',
        fantasyName: company.fantasyName ?? '',
        personType: (company.personType ?? undefined) as 'LEGAL' | 'PHYSICAL' | undefined,
        document: company.document ?? '',
        email: company.email ?? '',
        primaryPhone: company.primaryPhone ?? '',
        secondaryPhone: extras.secondaryPhone ?? '',
        timezone: extras.timezone ?? '',
        logoURL: company.logoURL ?? '',
        status: company.status ?? 'ACTIVE',
        type: company.type ?? 'ACCOUNT',
        address: company.address
          ? {
              cep: company.address.cep ?? '',
              address: company.address.address ?? '',
              number: company.address.number ?? '',
              complement: company.address.complement ?? '',
              neighborhood: company.address.neighborhood ?? '',
              city: company.address.city ?? '',
              state: company.address.state ?? '',
              country: company.address.country ?? 'BR',
              ibge: company.address.ibge ?? '',
              gia: company.address.gia ?? '',
              name: company.address.name ?? 'MAIN',
            }
          : undefined,
      };
      const result = companyFormSchema.safeParse(values);
      if (!result.success) console.error(result.error.format());
      expect(result.success).toBe(true);
    });

    // Also iterate all company-filter rows - ACCOUNT, CLIENT, SITE records
    // all flow through this schema in different admin contexts.
    const allCompanies = loadFixture('company-filter').results;
    it.each(allCompanies as any[])('accepts company-filter row $name (type=$type)', (row: any) => {
      const values = {
        _id: row._id,
        name: row.name ?? '',
        fantasyName: row.fantasyName ?? '',
        personType: (row.personType ?? undefined) as 'LEGAL' | 'PHYSICAL' | undefined,
        document: row.document ?? '',
        email: row.email ?? '',
        primaryPhone: row.primaryPhone ?? '',
        secondaryPhone: row.secondaryPhone ?? '',
        logoURL: row.logoURL ?? '',
        status: row.status ?? 'ACTIVE',
        type: row.type ?? 'ACCOUNT',
        address: row.address
          ? {
              cep: row.address.cep ?? '',
              address: row.address.address ?? '',
              number: row.address.number ?? '',
              complement: row.address.complement ?? '',
              neighborhood: row.address.neighborhood ?? '',
              city: row.address.city ?? '',
              state: row.address.state ?? '',
              country: row.address.country ?? 'BR',
              name: row.address.name ?? 'MAIN',
            }
          : undefined,
      };
      const result = companyFormSchema.safeParse(values);
      if (!result.success) console.error(result.error.format());
      expect(result.success).toBe(true);
    });
  });

  describe('equipmentFormSchema (/equipment)', () => {
    const fixture = loadFixture('equipments-filter');
    const rows = fixture.results;

    it.each(rows as any[])('accepts equipment $code ($_id)', (row: any) => {
      const values = {
        ...DEFAULT_EQUIPMENT_VALUES,
        _id: row._id,
        legacyId: row.legacyId ?? '',
        account: getIdOrEmpty(row.account),
        client: getIdOrEmpty(row.client),
        site: getIdOrEmpty(row.site),
        code: row.code ?? row.name ?? '',
        type: row.type ?? '',
        brand: row.brand ?? '',
        user: typeof row.user === 'string' ? row.user : '',
        hasImport: row.hasImport ?? true,
        companyLegacyParentId: row.companyLegacyParentId ?? '',
        status: row.status ?? 'ACTIVE',
      };
      const result = equipmentFormSchema.safeParse(values);
      if (!result.success) console.error(result.error.format());
      expect(result.success).toBe(true);
    });
  });
});
