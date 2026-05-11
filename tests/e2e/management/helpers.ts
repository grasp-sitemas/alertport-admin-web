import { expect, type Page } from '@playwright/test';

/**
 * Shared helpers for AlertPort Management E2E specs.
 *
 * Targets HML directly via PLAYWRIGHT_BASE_URL. Specs sign in with a real
 * SUPER_ADMIN_MASTER account and exercise the live API. Safety rules:
 *   - prefix every created entity name with `[E2E TEST]-...` so a human
 *     can tell automation rows apart from real data;
 *   - delete only what this run created;
 *   - never touch seed data.
 */

export const E2E_PREFIX = '[E2E TEST]';

export function makeTestName(label: string): string {
  return `${E2E_PREFIX}-${label}-${Date.now()}`;
}

export async function loginAsSuperAdmin(page: Page): Promise<void> {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD must be set in .env.test',
    );
  }

  await page.goto('/login');
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha|password/i).fill(password);
  await page.getByRole('button', { name: /^entrar$|sign in|ingresar/i }).click();

  await page.waitForURL(/\/(dashboard|alerts|users|clients|sites|equipment|collaborators|company)/, {
    timeout: 30_000,
  });
}

export async function gotoManagementPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

export async function clickCreateButton(page: Page): Promise<void> {
  const createButton = page.getByRole('button', { name: /^criar\s/i }).first();
  await createButton.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}

export async function clickSave(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /^salvar$/i }).click();
}

export type ToastKind = 'success' | 'error' | 'validation' | null;

export async function waitForToast(page: Page): Promise<ToastKind> {
  const SUCCESS = /sucesso/i;
  const VALIDATION = /corrija os campos|verifique os campos|obrigatório/i;
  const ERROR = /ocorreu um erro|erro ao/i;
  let kind: ToastKind = null;
  await expect
    .poll(
      async () => {
        const text = await page.locator('body').innerText();
        if (SUCCESS.test(text)) kind = 'success';
        else if (VALIDATION.test(text)) kind = 'validation';
        else if (ERROR.test(text)) kind = 'error';
        return kind;
      },
      { timeout: 15_000, message: 'No toast appeared after save - silent submit?' },
    )
    .not.toBeNull();
  return kind;
}

export async function openRowEdit(page: Page, rowText: string): Promise<void> {
  const row = page.locator('tr', { hasText: rowText }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const editBtn = row.locator('button').first();
  await editBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}

export async function openRowDelete(page: Page, rowText: string): Promise<void> {
  const row = page.locator('tr', { hasText: rowText }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const deleteBtn = row.locator('button').nth(1);
  await deleteBtn.click();
  const confirmBtn = page.getByRole('button', { name: /^confirmar$|excluir|arquivar/i }).last();
  await confirmBtn.click();
}

export async function pickSelectByLabel(
  page: Page,
  labelRegex: RegExp,
  optionText: string | RegExp,
): Promise<void> {
  const dialog = page.getByRole('dialog');
  const label = dialog.getByText(labelRegex).first();
  const container = label.locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]');
  await container.getByRole('combobox').click();
  await page.getByRole('option', { name: optionText }).first().click();
}
