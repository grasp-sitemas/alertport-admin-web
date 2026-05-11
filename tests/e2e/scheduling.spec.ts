/**
 * E2E: Schedule CRUD via the SchedulePreviewDialog flow.
 *
 * These specs run against the HML environment (or any URL configured via
 * `PLAYWRIGHT_BASE_URL`) and exercise the four operations operators perform
 * from the calendar: edit-occurrence, edit-series, delete-occurrence,
 * delete-series.
 *
 * They are intentionally resilient: when the calendar has no events for the
 * authenticated user, each spec skips with a clear message instead of
 * failing. This way we can ship the suite and let it light up as soon as
 * fixture data exists.
 *
 * Required env vars:
 *   - PLAYWRIGHT_TEST_EMAIL     (default read from .env.local / .env.test)
 *   - PLAYWRIGHT_TEST_PASSWORD
 *   - PLAYWRIGHT_BASE_URL       (defaults to https://admin-alertport-hml.vercel.app)
 *
 * Run:
 *   npx playwright test tests/e2e/scheduling.spec.ts --headed
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const HML_URL = 'https://admin-alertport-hml.vercel.app';
const SCHEDULING_PATH = '/alerts/scheduling';
const CALENDAR_TOUR_ATTR = '[data-tour="scheduling-calendar"]';
const FC_EVENT_SELECTOR = '.fc-event';

const EDIT_OCCURRENCE_RE = /editar esta ocorrência|edit this occurrence/i;
const EDIT_SERIES_RE = /editar toda a série|edit entire series/i;
const DELETE_OCCURRENCE_RE = /excluir esta ocorrência|delete this occurrence/i;
const DELETE_SERIES_RE = /excluir toda a série|delete entire series/i;
const CONFIRM_YES_RE = /sim, excluir|yes, delete|confirmar/i;

const TOAST_SAVED_RE = /salvo com sucesso|saved successfully/i;
const TOAST_DELETED_RE = /excluído com sucesso|deleted successfully/i;

/** Load credentials from env, falling back to .env.local / .env.test parsing. */
function loadCredentials(): { email: string; password: string } | null {
  const envEmail = process.env.PLAYWRIGHT_TEST_EMAIL;
  const envPassword = process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (envEmail && envPassword) return { email: envEmail, password: envPassword };

  const cwd = process.cwd();
  const candidates = ['.env.test', '.env.local'];
  const fileEnv: Record<string, string> = {};
  for (const file of candidates) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, '');
      if (!(match[1] in fileEnv)) fileEnv[match[1]] = value;
    }
  }
  const email = envEmail ?? fileEnv.PLAYWRIGHT_TEST_EMAIL;
  const password = envPassword ?? fileEnv.PLAYWRIGHT_TEST_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

function getBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? HML_URL;
}

/** Log in and land on the scheduling page. Reusable across specs. */
async function loginAndOpenScheduling(page: Page, email: string, password: string) {
  const baseUrl = getBaseUrl();
  await page.goto(`${baseUrl}/login`);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page
    .getByRole('button', { name: /entrar|sign in|ingresar|ログイン|登录/i })
    .click();

  // Wait until we leave /login (sessionStorage hydrated, RoleGuard resolved).
  await page.waitForURL((url) => !/\/login(\b|$)/.test(url.pathname), {
    timeout: 30_000,
  });

  await page.goto(`${baseUrl}${SCHEDULING_PATH}`);
  await expect(
    page.getByRole('heading', { name: /agendamento de alertas|alert scheduling/i }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(CALENDAR_TOUR_ATTR)).toBeVisible({ timeout: 20_000 });
}

/**
 * Try to click the first calendar event. Returns false when no events are
 * rendered (calendar empty for this account) so the caller can skip cleanly.
 */
async function openFirstEventPreview(page: Page): Promise<boolean> {
  const firstEvent = page.locator(FC_EVENT_SELECTOR).first();
  try {
    await firstEvent.waitFor({ state: 'visible', timeout: 8_000 });
  } catch {
    return false;
  }
  await firstEvent.click();
  const previewDialog = page.getByRole('dialog');
  await expect(previewDialog).toBeVisible({ timeout: 10_000 });
  // Action grid present — confirms it's the preview, not the form.
  await expect(page.getByRole('button', { name: EDIT_OCCURRENCE_RE })).toBeVisible({
    timeout: 10_000,
  });
  return true;
}

/** Asserts the preview's three context rows (period / time / location) rendered. */
async function assertPreviewBlockPopulated(page: Page) {
  await expect(page.getByText(/período|period/i).first()).toBeVisible();
  await expect(page.getByText(/janela|time window|horário/i).first()).toBeVisible();
  await expect(page.getByText(/local|location/i).first()).toBeVisible();
}

/**
 * Ensures the ScheduleFormDialog opens and its key fields are populated and
 * usable (equipment select must NOT be disabled — regression guard).
 */
async function assertFormPrefilledAndEnabled(page: Page) {
  const formDialog = page.getByRole('dialog').last();
  await expect(formDialog).toBeVisible({ timeout: 10_000 });

  const nameInput = formDialog.locator('input[name="name"]').first();
  await expect(nameInput).toBeVisible();
  await expect(nameInput).not.toHaveValue('');

  const beginDate = formDialog.locator('input[name="beginDate"]').first();
  if (await beginDate.count()) await expect(beginDate).not.toHaveValue('');

  const beginHour = formDialog.locator('input[name="beginHour"]').first();
  const endHour = formDialog.locator('input[name="endHour"]').first();
  if (await beginHour.count()) await expect(beginHour).not.toHaveValue('');
  if (await endHour.count()) await expect(endHour).not.toHaveValue('');

  // Equipment select trigger should be enabled.
  const equipmentTrigger = formDialog
    .locator('[name="equipment"], [aria-labelledby*="equipment" i], button[role="combobox"]')
    .first();
  if (await equipmentTrigger.count()) {
    await expect(equipmentTrigger).toBeEnabled();
  }
  return formDialog;
}

async function submitForm(page: Page) {
  const formDialog = page.getByRole('dialog').last();
  await formDialog
    .getByRole('button', { name: /salvar|save|atualizar|update/i })
    .first()
    .click();
}

async function expectToast(page: Page, message: RegExp) {
  await expect(page.locator('body').getByText(message).first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Schedule CRUD via Preview Dialog', () => {
  const credentials = loadCredentials();

  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials,
      'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD (or add them to .env.local / .env.test) to run schedule E2E specs.',
    );
    if (!credentials) return;
    await loginAndOpenScheduling(page, credentials.email, credentials.password);
  });

  test('Spec 1 — edits a single occurrence without mutating the form', async ({ page }) => {
    const hasEvent = await openFirstEventPreview(page);
    test.skip(!hasEvent, 'No schedule events visible for this account; cannot test edit-occurrence.');

    await assertPreviewBlockPopulated(page);

    await page.getByRole('button', { name: EDIT_OCCURRENCE_RE }).click();
    await assertFormPrefilledAndEnabled(page);

    // Submit without changes — must succeed (no "invalid input" toast).
    await submitForm(page);
    await expectToast(page, TOAST_SAVED_RE);
  });

  test('Spec 2 — edits an entire series', async ({ page }) => {
    const hasEvent = await openFirstEventPreview(page);
    test.skip(!hasEvent, 'No schedule events visible for this account; cannot test edit-series.');

    await assertPreviewBlockPopulated(page);

    await page.getByRole('button', { name: EDIT_SERIES_RE }).click();
    await assertFormPrefilledAndEnabled(page);

    await submitForm(page);
    await expectToast(page, TOAST_SAVED_RE);
  });

  test('Spec 3 — deletes a single occurrence (inline confirm)', async ({ page }) => {
    const hasEvent = await openFirstEventPreview(page);
    test.skip(!hasEvent, 'No schedule events visible for this account; cannot test delete-occurrence.');

    // First click swaps the card for the inline confirm UI.
    await page.getByRole('button', { name: DELETE_OCCURRENCE_RE }).click();

    const confirmBtn = page.getByRole('button', { name: CONFIRM_YES_RE }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });
    await expectToast(page, TOAST_DELETED_RE);
  });

  test('Spec 4 — deletes the entire series (inline confirm)', async ({ page }) => {
    const hasEvent = await openFirstEventPreview(page);
    test.skip(!hasEvent, 'No schedule events visible for this account; cannot test delete-series.');

    await page.getByRole('button', { name: DELETE_SERIES_RE }).click();

    const confirmBtn = page.getByRole('button', { name: CONFIRM_YES_RE }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });
    await expectToast(page, TOAST_DELETED_RE);
  });
});
