/**
 * E2E: Attendance report (/reports/attendance).
 * Same structural validations as adherence: today-range ISO, device →
 * `equipment` body, chronological ascending sort.
 */
import { test, expect, type Page, type Request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_HML = 'https://admin-alertport-hml.vercel.app';
const REPORT_PATH = '/reports/attendance';
const REPORT_URL_SUBSTRING = '/api/reports/alertport/attendance/v1/';
const FULL_ISO_RE = /T\d{2}:\d{2}:\d{2}/;

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
  await page.waitForURL((url) => !/\/login(\b|$)/.test(url.pathname), { timeout: 60_000 });
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

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test.describe.configure({ timeout: 90_000 });

test.describe('Report — Attendance', () => {
  const credentials = loadCredentials();

  test.beforeEach(async ({ page }) => {
    test.skip(!credentials, 'Missing PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD.');
    if (!credentials) return;
    await login(page, credentials.email, credentials.password);
    await page.goto(`${getBaseUrl()}${REPORT_PATH}`);
  });

  test('Spec 1 — page renders', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 30_000 });
  });

  test('Spec 2 — today-only range POSTs full ISO timestamps', async ({ page }) => {
    const today = todayYMD();
    await page.locator('#report-start-date').fill(today);
    await page.locator('#report-end-date').fill(today);

    const promise = captureNextPost(page, REPORT_URL_SUBSTRING);
    await page
      .getByRole('button', { name: /buscar|search|aplicar|apply/i })
      .first()
      .click();
    const body = await promise;
    expect(body, 'Expected POST to attendance report endpoint').not.toBeNull();
    if (!body) return;
    expect(body.startDate as string).toMatch(FULL_ISO_RE);
    expect(body.endDate as string).toMatch(FULL_ISO_RE);
  });

  test('Spec 3 — device filter sends `equipment`', async ({ page }) => {
    const a = await pickFirstRealOption(page, page.getByRole('combobox').nth(0));
    test.skip(!a, 'No account options.');
    const c = await pickFirstRealOption(page, page.getByRole('combobox').nth(1));
    test.skip(!c, 'No client options.');
    const s = await pickFirstRealOption(page, page.getByRole('combobox').nth(2));
    test.skip(!s, 'No site options.');
    const d = await pickFirstRealOption(page, page.getByRole('combobox').nth(3));
    test.skip(!d, 'No device options.');

    const promise = captureNextPost(page, REPORT_URL_SUBSTRING);
    await page
      .getByRole('button', { name: /buscar|search|aplicar|apply/i })
      .first()
      .click();
    const body = await promise;
    expect(body && body.equipment).toBeTruthy();
  });

  test('Spec 4 — initial ordering is chronological ascending', async ({ page }) => {
    await expect(
      page.getByRole('table').or(page.getByText(/sem resultados|no results/i)),
    ).toBeVisible({ timeout: 30_000 });
    const rows = page.getByRole('row');
    const count = await rows.count();
    test.skip(count <= 2, 'Need at least 2 data rows.');
    const first = (await rows.nth(1).locator('td').nth(0).textContent()) ?? '';
    const last =
      (await rows
        .nth(count - 1)
        .locator('td')
        .nth(0)
        .textContent()) ?? '';
    const a = Date.parse(first);
    const b = Date.parse(last);
    if (Number.isFinite(a) && Number.isFinite(b)) expect(a).toBeLessThanOrEqual(b);
    else expect(first.localeCompare(last)).toBeLessThanOrEqual(0);
  });
});
