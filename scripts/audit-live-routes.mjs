/** Read-only browser audit. Requires a locally built candidate configured for the target API. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const apiOrigin = process.env.ALERTPORT_AUDIT_API_ORIGIN;
const credentialsFile = process.env.ALERTPORT_AUDIT_CREDENTIALS_FILE;
const output = process.env.ALERTPORT_AUDIT_OUTPUT;
const expectedDenied = new Set((process.env.ALERTPORT_AUDIT_EXPECT_DENIED || '').split(',').filter(Boolean));
if (!baseURL || !apiOrigin || !credentialsFile || !output) {
  throw new Error('Set PLAYWRIGHT_BASE_URL, ALERTPORT_AUDIT_API_ORIGIN, ALERTPORT_AUDIT_CREDENTIALS_FILE and ALERTPORT_AUDIT_OUTPUT.');
}
const credentials = JSON.parse(await fs.readFile(credentialsFile, 'utf8'));
if (!credentials.email || !credentials.password) throw new Error('Audit credentials are incomplete.');

async function routePaths(directory, prefix = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const routes = entries.some(entry => entry.name === 'page.tsx') ? [prefix || '/'] : [];
  for (const entry of entries) {
    if (entry.isDirectory()) routes.push(...await routePaths(path.join(directory, entry.name), `${prefix}/${entry.name}`));
  }
  return routes;
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});
const context = await browser.newContext({ baseURL });
const page = await context.newPage();
const report = {
  startedAt: new Date().toISOString(), baseURL, apiOrigin,
  scope: 'Read-only route rendering and live HTTP results; does not prove CRUD persistence or mobile delivery.',
  role: null, rows: [],
};
let current;
const owners = new WeakMap();
function safeURL(value) { const url = new URL(value); return `${url.origin}${url.pathname}`; }
function safeError(error) {
  return String(error?.message ?? error)
    .replaceAll(credentials.email, '[redacted]')
    .replaceAll(credentials.password, '[redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/g, value => safeURL(value))
    .slice(0, 500);
}
function row(route) { return { route, pageStatus: null, finalPath: null, headingVisible: false, api: [], networkErrors: [], pageErrors: [], pending: new Set(), state: 'pending' }; }

// Fail if a build accidentally points at production while auditing HML.
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== apiOrigin) {
    current?.networkErrors.push({ url: safeURL(url.href), reason: 'Unexpected API origin in candidate build' });
    await route.abort('blockedbyclient');
    return;
  }
  await route.continue();
});
page.on('request', request => {
  if (!current || !new URL(request.url()).pathname.startsWith('/api/')) return;
  owners.set(request, current);
  current.pending.add(request);
});
page.on('response', response => {
  const owner = owners.get(response.request());
  if (!owner) return;
  owner.pending.delete(response.request());
  owner.api.push({ method: response.request().method(), url: safeURL(response.url()), status: response.status() });
});
page.on('requestfailed', request => {
  const owner = owners.get(request);
  if (!owner) return;
  owner.pending.delete(request);
  owner.networkErrors.push({ url: safeURL(request.url()), reason: request.failure()?.errorText });
});
page.on('pageerror', error => current?.pageErrors.push(safeError(error)));

async function settle(row) {
  const deadline = Date.now() + 35_000;
  do {
    await page.waitForTimeout(500);
    if (!row.pending.size) return;
  } while (Date.now() < deadline);
}

try {
  current = row('/login');
  report.rows.push(current);
  current.pageStatus = (await page.goto('/login', { waitUntil: 'domcontentloaded' }))?.status() ?? null;
  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.getByRole('button', { name: /^entrar$|sign in|ingresar/i }).click();
  await page.waitForURL(url => url.pathname !== '/login', { timeout: 60_000 });
  await settle(current);
  current.finalPath = new URL(page.url()).pathname;
  current.headingVisible = await page.locator('main h1, main h2').first().isVisible();
  current.state = 'authenticated';
  report.role = await page.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem('alertport_session') || '{}');
    return session.user?.companyUser?.subtype ?? null;
  });

  for (const route of (await routePaths(path.resolve('src/app/(app)'))).sort()) {
    current = row(route);
    report.rows.push(current);
    try {
      current.pageStatus = (await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 45_000 }))?.status() ?? null;
      await page.locator('main').waitFor({ state: 'visible', timeout: 30_000 });
      await settle(current);
      current.finalPath = new URL(page.url()).pathname;
      current.headingVisible = await page.locator('main h1, main h2, main h3').first().isVisible();
      current.denied = await page.locator('main').getByText(/acesso negado|sem permissão|não tem permissão|módulo indisponível/i).count() > 0;
      const failed = current.pageErrors.length || current.networkErrors.length || current.api.some(response => response.status >= 400) || current.pending.size;
      current.state = failed ? 'failed' : current.denied ? 'access_denied' : current.pageStatus === 200 && current.headingVisible && current.finalPath === route ? 'loaded' : 'incomplete';
    } catch (error) {
      current.state = 'failed';
      current.pageErrors.push(safeError(error));
    }
    console.log(JSON.stringify({ route, state: current.state, requests: current.api.length, errors: current.networkErrors.length + current.pageErrors.length + current.api.filter(response => response.status >= 400).length }));
  }
} catch (error) {
  report.error = safeError(error);
} finally {
  report.finishedAt = new Date().toISOString();
  report.rows = report.rows.map(({ pending, ...value }) => ({ ...value, pendingRequests: pending.size }));
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  await browser.close();
}
if (report.error || report.rows.some(row =>
  ['failed', 'incomplete', 'pending'].includes(row.state) ||
  (row.state === 'access_denied' && !expectedDenied.has(row.route)) ||
  (expectedDenied.has(row.route) && row.state !== 'access_denied') ||
  row.networkErrors.length || row.pageErrors.length || row.api.some(response => response.status >= 400)
)) process.exitCode = 1;
