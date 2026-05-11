/**
 * Real-credential HML login helper for Playwright specs.
 *
 * Distinct from `session.ts`, which seeds a synthetic session against a
 * stubbed API. This helper drives the actual login form so the test runs
 * end-to-end against HML (`admin-alertport-hml.vercel.app`).
 *
 * Credentials are read from env vars (set via `.env.test` or CLI):
 *   - PLAYWRIGHT_TEST_EMAIL
 *   - PLAYWRIGHT_TEST_PASSWORD
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface LoginCredentials {
  email: string;
  password: string;
}

export function getHmlCredentials(): LoginCredentials {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL?.trim();
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error(
      'PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set (see .env.test).',
    );
  }
  return { email, password };
}

/**
 * Drive the login form and wait for redirect to /dashboard.
 * Idempotent: if a valid session already exists, the page auto-redirects.
 */
export async function loginToHml(
  page: Page,
  creds: LoginCredentials = getHmlCredentials(),
): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  if (/\/dashboard/.test(page.url())) return;

  await page.locator('#email').fill(creds.email);
  await page.locator('#password').fill(creds.password);
  await page.getByRole('button', { name: /entrar|sign in|ingresar|ログイン|登录/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/dashboard/);
}
