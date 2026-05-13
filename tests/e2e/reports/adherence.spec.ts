/**
 * E2E: Adherence report (/reports/adherence).
 *
 * Validates:
 *   - Page label is "Aderência de Alertas" (not the old "Ronda").
 *   - Today-only date range (startDate === endDate === today) POSTs a
 *     full ISO timestamp, NOT a bare YYYY-MM-DD. This is the RP5 fix.
 *   - Selecting a device sends `equipment` on the wire.
 *   - Initial table ordering is chronological ascending by scheduledAt.
 */
import { test, expect, type Page, type Request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_HML = 'https://admin-alertport-hml.vercel.app';
const REPORT_PATH = '/reports/adherence';
const REPORT_URL_SUBSTRING = '/api/reports/alertport/adherence/v1/';
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
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test.describe.configure({ timeout: 90_000 });

test.describe('Report — Aderência de Alertas', () => {
  const credentials = loadCredentials();

  test.beforeEach(async ({ page }) => {
    test.skip(!credentials, 'Missing PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD.');
    if (!credentials) return;
    await login(page, credentials.email, credentials.password);
    await page.goto(`${getBaseUrl()}${REPORT_PATH}`);
  });

  test('Spec 1 — page renders with "Aderência de Alertas" label', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /aderência de alertas/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    const ronda = page.locator('h1, h2').filter({ hasText: /ronda/i });
    await expect(ronda).toHaveCount(0);
  });

  test('Spec 2 — today-only range POSTs full ISO timestamps (RP5)', async ({ page }) => {
    const today = todayYMD();
    await page.locator('#report-start-date').fill(today);
    await page.locator('#report-end-date').fill(today);

    const filterPromise = captureNextPost(page, REPORT_URL_SUBSTRING);
    await page
      .getByRole('button', { name: /buscar|search|aplicar|apply/i })
      .first()
      .click();
    const body = await filterPromise;
    expect(body, 'Expected POST to adherence endpoint').not.toBeNull();
    if (!body) return;
    expect(typeof body.startDate).toBe('string');
    expect(typeof body.endDate).toBe('string');
    expect(body.startDate as string).toMatch(FULL_ISO_RE);
    expect(body.endDate as string).toMatch(FULL_ISO_RE);
    expect(body.startDate).not.toBe(today);
    expect(body.endDate).not.toBe(today);
  });

  test('Spec 3 — device filter travels as `equipment` in POST body', async ({ page }) => {
    const accountTrigger = page.getByRole('combobox').nth(0);
    const accountPicked = await pickFirstRealOption(page, accountTrigger);
    test.skip(!accountPicked, 'No account options for this user.');

    const clientTrigger = page.getByRole('combobox').nth(1);
    const clientPicked = await pickFirstRealOption(page, clientTrigger);
    test.skip(!clientPicked, 'No client options after account selection.');

    const siteTrigger = page.getByRole('combobox').nth(2);
    const sitePicked = await pickFirstRealOption(page, siteTrigger);
    test.skip(!sitePicked, 'No site options after client selection.');

    const deviceTrigger = page.getByRole('combobox').nth(3);
    const devicePicked = await pickFirstRealOption(page, deviceTrigger);
    test.skip(!devicePicked, 'No device options for the selected site.');

    const filterPromise = captureNextPost(page, REPORT_URL_SUBSTRING);
    await page
      .getByRole('button', { name: /buscar|search|aplicar|apply/i })
      .first()
      .click();
    const body = await filterPromise;
    expect(body, 'Expected POST to adherence endpoint').not.toBeNull();
    expect(body && body.equipment).toBeTruthy();
  });

  test('Spec 4 — initial table ordering is chronological ascending', async ({ page }) => {
    await expect(
      page.getByRole('table').or(page.getByText(/sem resultados|no results/i)),
    ).toBeVisible({ timeout: 30_000 });

    const rows = page.getByRole('row');
    const count = await rows.count();
    test.skip(count <= 2, 'Need at least 2 data rows for sort assertion.');

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
