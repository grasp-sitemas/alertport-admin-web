/**
 * Seed session + API mock helpers for Playwright smoke tests.
 *
 * The smoke tests exercise the FE form flow without ever hitting the real
 * API. They install a synthetic session in sessionStorage, then intercept
 * the filter + detail endpoints to return fixture data. This makes the
 * tests hermetic (run offline, never rate-limit HML) while still exercising
 * the full React Hook Form + zod + useAppForm stack that actually runs in
 * production.
 */

import type { Page, Route } from '@playwright/test';

export const adminSession = {
  token: 'test-token-admin',
  language: 'pt',
  user: {
    _id: '631b46da51e6a07b54d5c464',
    firstName: 'E2E',
    lastName: 'Admin',
    email: 'e2e-admin@example.com',
    status: 'ACTIVE',
    type: 'USER-COMPANY',
    companyUser: {
      _id: '631b46d951e6a07b54d5c461',
      subtype: 'ADMIN',
      status: 'ACTIVE',
    },
    account: {
      _id: '64514294c86e6e000f6252dd',
      name: 'E2E Account',
    },
  },
};

export async function seedSession(page: Page, session = adminSession) {
  await page.addInitScript((value) => {
    sessionStorage.setItem('alertport_session', JSON.stringify(value));
  }, session);
}

/**
 * Mock EVERY outbound request that could silently fail the page.
 * Matches against the `https://api-hml...` base used by the client; we also
 * catch `api-chat` socket polls so the recordings panel / call dialog don't
 * throw.
 */
export async function mockApi(page: Page, routes: Record<string, unknown>) {
  const handler = async (route: Route) => {
    const url = route.request().url();
    for (const [pattern, payload] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payload),
        });
        return;
      }
    }

    // Account modules are fetched by the global shell before most pages
    // render. Keep the hermetic smoke user fully enabled; otherwise an
    // unmocked request can escape to HML, return 401, and expire the
    // synthetic session before the test reaches the behavior under test.
    if (url.includes('/api/company/modules/by-account/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          single({
            modules: {
              MONITOR: true,
              SCHEDULING: true,
              REPORTS: true,
              TIME_ENTRIES: true,
            },
          }),
        ),
      });
      return;
    }

    // Background bootstrap calls (trial, plan, onboarding, etc.) are not
    // relevant to CRUD smoke coverage. Return a valid empty envelope so the
    // suite is genuinely offline and never authenticates against live HML.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 200, results: [], totalCount: 0, result: {} }),
    });
  };
  await page.route('**/api/**', handler);
  await page.route(/api-chat/, handler);
  await page.route('**/filemanager/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
}

/** Standard envelope used by the shieldgo API. */
export function envelope<T>(results: T[], totalCount = results.length) {
  return { status: 200, results, totalCount, page: 1, limit: 20 };
}

export function single<T>(result: T) {
  return { status: 200, result };
}

/**
 * Canonical sample rows the smoke tests load into the CRUD lists.
 * Intentionally kept minimal - what we're testing is "edit form opens and
 * the form dialog can submit without silent drop", not data completeness.
 */
export const sampleAccount = {
  _id: '64514294c86e6e000f6252dd',
  name: 'E2E Account',
  fantasyName: 'E2E',
  type: 'ACCOUNT',
  status: 'ACTIVE',
  personType: 'LEGAL',
  document: '00000000000',
  email: 'account@example.com',
  primaryPhone: '11999999999',
  logoURL: '/filemanager/photo/account.png',
  address: {
    cep: '04619-000',
    address: 'Rua Central',
    number: '100',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    name: 'MAIN',
  },
};

export const sampleClient = {
  _id: '647a1e20ecff11000fccb901',
  name: 'E2E Client',
  type: 'CLIENT',
  status: 'ACTIVE',
  account: sampleAccount._id,
  email: 'client@example.com',
  primaryPhone: '11999999998',
};

export const sampleSite = {
  _id: '673f9925a6894ee9685a9092',
  name: 'E2E Site',
  type: 'SITE',
  status: 'ACTIVE',
  account: sampleAccount._id,
  client: sampleClient._id,
  primaryPhone: '11999999997',
  address: {
    cep: '04720-000',
    address: 'Rua Site',
    number: '200',
    neighborhood: 'Vila',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    name: 'MAIN',
  },
};

export const sampleCompanyUser = {
  _id: '6499d3e0e7d6a4000f8a69e6',
  firstName: 'Operator',
  lastName: 'One',
  email: 'operator@example.com',
  username: 'operator1',
  primaryPhone: '11999999996',
  status: 'ACTIVE',
  type: 'USER-COMPANY',
  account: sampleAccount._id,
  client: sampleClient._id,
  site: sampleSite._id,
  companyUser: { subtype: 'OPERATOR', status: 'ACTIVE' },
  address: { name: 'MAIN' },
};

export const sampleCollaborator = {
  _id: '674484f4ae5dcdb407a3e53f',
  firstName: 'Vigilant',
  lastName: 'One',
  email: 'vigilant@example.com',
  username: 'vigilant1',
  status: 'ACTIVE',
  type: 'USER-CUSTOMER',
  account: sampleAccount._id,
  client: sampleClient._id,
  site: sampleSite._id,
  customerUser: {
    subtype: 'VIGILANT',
    status: 'ACTIVE',
    employeeCode: 'VIG-0001',
  },
  address: { name: 'MAIN' },
};

export const sampleEquipment = {
  _id: '672000000000000000000001',
  code: 'PANIC-0001',
  name: 'Panic Button',
  type: 'PANIC',
  brand: 'SHIELDGO',
  hasImport: true,
  status: 'ACTIVE',
  account: sampleAccount._id,
  client: sampleClient._id,
  site: sampleSite._id,
};
