import { test, expect, type Page } from '@playwright/test';
import {
  seedSession,
  mockApi,
  envelope,
  single,
  sampleAccount,
  sampleClient,
  sampleSite,
  sampleCompanyUser,
  sampleCollaborator,
  sampleEquipment,
} from './fixtures/session';

/**
 * Smoke tests that exercise the "edit existing record → Save" flow across
 * every CRUD form. The invariant under test:
 *
 *   Clicking Save MUST either succeed (success toast) or surface a visible
 *   validation toast. A silent outcome is a bug.
 *
 * This protects against the two prod incidents that motivated the plan:
 *   - zod enum rejecting a legacy API field (`WHITE-LABEL-COMPANY`) → Save
 *     does nothing.
 *   - handleSubmit(onValid) with no onInvalid → same silent drop.
 *
 * API calls are stubbed so the tests are hermetic and fast. The filter
 * endpoint returns a single row that matches the form's schema; the
 * formdata PUT/POST endpoints echo back `{ status: 200, result: <row> }`.
 */

// Matches messages from src/messages/pt.json. Keep broad so future copy
// tweaks don't break the smoke test.
const SUCCESS = /atualizado com sucesso|criado com sucesso|salvo com sucesso|atualizada com sucesso|criada com sucesso/i;
const VALIDATION = /corrija os campos|verifique os campos|obrigatório/i;
const GENERIC_ERROR = /ocorreu um erro/i;

async function waitForSaveOutcome(page: Page) {
  // A successful mutation, a validation toast, or a generic error toast -
  // any ONE of those is acceptable. What we refuse is silence.
  await expect
    .poll(
      async () => {
        const bodyText = await page.locator('body').innerText();
        if (SUCCESS.test(bodyText)) return 'success';
        if (VALIDATION.test(bodyText)) return 'validation';
        if (GENERIC_ERROR.test(bodyText)) return 'error';
        return null;
      },
      { timeout: 10_000, message: 'Clicking Save produced no toast - the submit was silent' },
    )
    .not.toBeNull();
}

async function clickSave(page: Page) {
  await page.getByRole('button', { name: /^salvar$/i }).last().click();
}

async function clickRowEdit(page: Page) {
  // Admin lists expose an edit affordance via an icon button or a menu
  // entry. Try the common patterns.
  const editButton = page.getByRole('button', { name: /editar|edit/i }).first();
  if (await editButton.isVisible().catch(() => false)) {
    await editButton.click();
    return;
  }
  const rowMenu = page.getByRole('button', { name: /abrir menu|open menu|more/i }).first();
  if (await rowMenu.isVisible().catch(() => false)) {
    await rowMenu.click();
    await page.getByRole('menuitem', { name: /editar|edit/i }).first().click();
    return;
  }
  throw new Error('No edit control found on the list page');
}

test.describe('CRUD form smoke - every edit+save path must toast an outcome', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('users list → edit first row → save', async ({ page }) => {
    await mockApi(page, {
      '/api/users/system/search/companyuser/v1/': envelope([sampleCompanyUser]),
      '/api/users/formdata/v1/': single(sampleCompanyUser),
      '/api/users/check/email/v1/': single({ alreadyExist: false }),
      '/api/users/check/username/v1/': single({ alreadyExist: false }),
      '/api/company/filter/v1/': envelope([sampleAccount, sampleClient, sampleSite]),
    });

    await page.goto('/users');
    await expect(page.getByText('Operator One')).toBeVisible();
    await clickRowEdit(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await clickSave(page);
    await waitForSaveOutcome(page);
  });

  test('collaborators list → edit first row → save', async ({ page }) => {
    await mockApi(page, {
      '/api/users/system/search/customeruser/v1/': envelope([sampleCollaborator]),
      '/api/users/formdata/v1/': single(sampleCollaborator),
      '/api/users/check/email/v1/': single({ alreadyExist: false }),
      '/api/users/check/username/v1/': single({ alreadyExist: false }),
      '/api/company/filter/v1/': envelope([sampleAccount, sampleClient, sampleSite]),
    });

    await page.goto('/collaborators');
    await expect(page.getByText('Vigilant One')).toBeVisible();
    await clickRowEdit(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await clickSave(page);
    await waitForSaveOutcome(page);
  });

  test('clients list → edit first row → save', async ({ page }) => {
    await mockApi(page, {
      '/api/company/filter/v1/': envelope([sampleClient, sampleAccount]),
      '/api/company/formdata/v1/': single(sampleClient),
    });

    await page.goto('/clients');
    await expect(page.getByText('E2E Client')).toBeVisible();
    await clickRowEdit(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await clickSave(page);
    await waitForSaveOutcome(page);
  });

  test('sites list → edit first row → save', async ({ page }) => {
    await mockApi(page, {
      '/api/company/filter/v1/': envelope([sampleSite, sampleClient, sampleAccount]),
      '/api/company/formdata/v1/': single(sampleSite),
      '/api/address/geo/v1/': { status: 200, results: [] },
    });

    await page.goto('/sites');
    await expect(page.getByText('E2E Site')).toBeVisible();
    await clickRowEdit(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await clickSave(page);
    await waitForSaveOutcome(page);
  });

  test('equipment list → edit first row → save', async ({ page }) => {
    await mockApi(page, {
      '/api/company/equipments/filter/v1/': envelope([sampleEquipment]),
      '/api/company/equipments/v1/': single(sampleEquipment),
      '/api/company/filter/v1/': envelope([sampleAccount, sampleClient, sampleSite]),
      '/api/helpers/data/equipments/brands/v1/': {
        status: 200,
        result: [{ _id: 'SHIELDGO', name: 'ShieldGo' }],
      },
      '/api/helpers/data/equipments/types/v1/': {
        status: 200,
        result: [{ _id: 'PANIC', name: 'Panic' }],
      },
    });

    await page.goto('/equipment');
    await expect(page.getByText('PANIC-0001')).toBeVisible();
    await clickRowEdit(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await clickSave(page);
    await waitForSaveOutcome(page);
  });

  test('company page → save form', async ({ page }) => {
    // The company route pulls its data from /me, not a filter endpoint.
    await mockApi(page, {
      '/api/users/system/companyuser/me/v1': single({
        ...sampleAccount,
        companyUser: { subtype: 'ADMIN', status: 'ACTIVE' },
        account: sampleAccount,
        company: sampleAccount,
      }),
      '/api/company/formdata/v1/': single(sampleAccount),
      '/api/address/geo/v1/': { status: 200, results: [] },
    });

    await page.goto('/company');
    await expect(page.locator('input[name="name"]')).toBeVisible();
    // The company page has an always-visible Save button.
    await clickSave(page);
    await waitForSaveOutcome(page);
  });
});
