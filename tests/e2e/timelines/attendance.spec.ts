/**
 * E2E: Attendance (time-entries) timeline (/attendance).
 *
 * Mirrors the structure of timelines/occurrences.spec.ts. The
 * attendance page reuses the shared FilterPanel + HierarchyFilters but
 * its filter POST hits a different endpoint and the timestamp column
 * is `timestamp` (rendered from `createdAt`).
 */
import { test, expect, type Page, type Request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_HML = 'https://admin-alertport-hml.vercel.app';
const ATTENDANCE_PATH = '/attendance';
// The page uses `useTimeEntries` which posts to
// `/api/users/attendances/filter/v1/` (see src/config/endpoints.ts).
const FILTER_URL_SUBSTRING = '/api/users/attendances/filter/v1/';

function loadCredentials(): { email: string; password: string } | null {
  const envEmail = process.env.PLAYWRIGHT_TEST_EMAIL;
  const envPassword = process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (envEmail && envPassword) return { email: envEmail, password: envPassword };
  const fileEnv: Record<string, string> = {};
  for (const file of ['.env.test', '.env.local']) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, '');
      if (!(m[1] in fileEnv)) fileEnv[m[1]] = value;
    }
  }
  const email = envEmail ?? fileEnv.PLAYWRIGHT_TEST_EMAIL;
  const password = envPassword ?? fileEnv.PLAYWRIGHT_TEST_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

function getBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_HML;
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${getBaseUrl()}/login`);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /entrar|sign in|ingresar|ログイン|登录/i }).click();
  await page.waitForURL((url) => !/\/login(\b|$)/.test(url.pathname), {
    timeout: 60_000,
  });
}

function captureNextPost(
  page: Page,
  urlSubstring: string,
  timeoutMs = 15_000,
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    const handler = (req: Request) => {
      if (req.method() !== 'POST' || !req.url().includes(urlSubstring)) return;
      page.off('request', handler);
      clearTimeout(timer);
      try {
        const raw = req.postData();
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : null);
      } catch {
        resolve(null);
      }
    };
    page.on('request', handler);
  });
}

async function pickFirstRealOption(
  page: Page,
  trigger: ReturnType<Page['locator']>,
): Promise<string | null> {
  await trigger.click();
  const options = page.getByRole('option');
  await options
    .first()
    .waitFor({ state: 'visible', timeout: 5_000 })
    .catch(() => null);
  const total = await options.count();
  for (let i = 0; i < total; i += 1) {
    const opt = options.nth(i);
    const text = (await opt.textContent())?.trim() ?? '';
    if (i === 0 && /^(todos|all|todas|すべて|全部)$/i.test(text)) continue;
    await opt.click();
    return text;
  }
  await page.keyboard.press('Escape');
  return null;
}

test.describe.configure({ timeout: 90_000 });

test.describe('Attendance / Time-entries timeline', () => {
  const credentials = loadCredentials();

  test.beforeEach(async ({ page }) => {
    test.skip(!credentials, 'Missing PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD.');
    if (!credentials) return;
    await login(page, credentials.email, credentials.password);
    await page.goto(`${getBaseUrl()}${ATTENDANCE_PATH}`);
    await expect(
      page.getByRole('table').or(page.getByText(/sem resultados|no results/i)),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('Spec 1 — loads authenticated and renders the DataTable region', async ({ page }) => {
    const header = page.getByRole('columnheader').filter({
      hasText: /timestamp|horário|hora/i,
    });
    await expect(header.first()).toBeVisible();
  });

  test('Spec 2 — site filter then device filter both trigger filter POST', async ({ page }) => {
    const accountTrigger = page.getByRole('combobox').nth(0);
    const accountPicked = await pickFirstRealOption(page, accountTrigger);
    test.skip(!accountPicked, 'No account options for this user.');

    const clientTrigger = page.getByRole('combobox').nth(1);
    const clientPicked = await pickFirstRealOption(page, clientTrigger);
    test.skip(!clientPicked, 'No client options after account selection.');

    const siteTrigger = page.getByRole('combobox').nth(2);
    const sitePicked = await pickFirstRealOption(page, siteTrigger);
    test.skip(!sitePicked, 'No site options after client selection.');

    const filterPromise = captureNextPost(page, FILTER_URL_SUBSTRING);
    await page
      .getByRole('button', { name: /buscar|search/i })
      .first()
      .click();
    const body = await filterPromise;
    expect(body, 'Expected POST to attendances filter endpoint').not.toBeNull();
    expect(body && (body.site || body.account)).toBeTruthy();

    const deviceTrigger = page.getByRole('combobox').nth(3);
    const devicePicked = await pickFirstRealOption(page, deviceTrigger);
    test.skip(!devicePicked, 'No device options for the selected site.');

    const filterPromise2 = captureNextPost(page, FILTER_URL_SUBSTRING);
    await page
      .getByRole('button', { name: /buscar|search/i })
      .first()
      .click();
    const body2 = await filterPromise2;
    expect(body2, 'Expected second POST after device pick').not.toBeNull();
    expect(body2 && body2.equipment).toBeTruthy();
  });

  test('Spec 3 — clicking timestamp header inverts the row ordering', async ({ page }) => {
    const rows = page.getByRole('row');
    const rowCount = await rows.count();
    test.skip(rowCount <= 2, 'Need at least 2 data rows to test sort inversion.');

    const beforeFirst = (await rows.nth(1).textContent())?.trim() ?? '';
    await page
      .getByRole('button', { name: /timestamp|horário|hora/i })
      .first()
      .click();
    const afterFirst = (await rows.nth(1).textContent())?.trim() ?? '';
    expect(afterFirst).not.toBe(beforeFirst);
  });

  test('Spec 4 — initial load is chronological ascending', async ({ page }) => {
    const rows = page.getByRole('row');
    const count = await rows.count();
    test.skip(count <= 2, 'Need at least 2 data rows to test ascending order.');

    const firstCell = await rows.nth(1).locator('td').nth(0).textContent();
    const lastCell = await rows
      .nth(count - 1)
      .locator('td')
      .nth(0)
      .textContent();
    const first = Date.parse(firstCell ?? '');
    const last = Date.parse(lastCell ?? '');
    if (Number.isFinite(first) && Number.isFinite(last)) {
      expect(first).toBeLessThanOrEqual(last);
    } else {
      expect((firstCell ?? '').localeCompare(lastCell ?? '')).toBeLessThanOrEqual(0);
    }
  });
});
