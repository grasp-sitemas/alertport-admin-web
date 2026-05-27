import { test, expect } from '@playwright/test';

/**
 * Product isolation smoke test (HML).
 *
 * Verifies that after login the alertport-admin-web persists the JWT
 * `product` claim in sessionStorage and injects the `X-Product` header
 * on outbound API calls.
 *
 * Run against HML with credentials seeded in `process.env`:
 *   ALERTPORT_TEST_EMAIL=...
 *   ALERTPORT_TEST_PASSWORD=...
 *
 * If creds are missing the test is skipped (avoids breaking CI without
 * a fixture user).
 */
test.describe('product-isolation', () => {
  const email = process.env.ALERTPORT_TEST_EMAIL;
  const password = process.env.ALERTPORT_TEST_PASSWORD;

  test.skip(!email || !password, 'requires ALERTPORT_TEST_* env vars');

  test('session carries product=ALERTPORT after login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/e-?mail/i).fill(email!);
    await page.getByLabel(/senha|password|contraseña/i).fill(password!);
    await page.getByRole('button', { name: /entrar|sign in|ingresar/i }).click();

    await page.waitForURL(/dashboard|alerts|users|alert-monitor/i, { timeout: 15000 });

    const session = await page.evaluate(() => {
      const raw = sessionStorage.getItem('alertport_session');
      return raw ? JSON.parse(raw) : null;
    });

    expect(session).not.toBeNull();
    expect(session.token).toBeTruthy();
    // Backend echoed `product` claim — default to ALERTPORT on this app.
    expect(['ALERTPORT', 'ALL']).toContain(session.product);
  });

  test('outbound API requests carry X-Product header', async ({ page }) => {
    const xProductHeaders: string[] = [];

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/')) {
        const hdr = req.headers()['x-product'];
        if (hdr) xProductHeaders.push(hdr);
      }
    });

    await page.goto('/login');
    await page.getByLabel(/e-?mail/i).fill(email!);
    await page.getByLabel(/senha|password|contraseña/i).fill(password!);
    await page.getByRole('button', { name: /entrar|sign in|ingresar/i }).click();
    await page.waitForURL(/dashboard|alerts|users|alert-monitor/i, { timeout: 15000 });

    // Trigger a navigation that fires API calls.
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    expect(xProductHeaders.length).toBeGreaterThan(0);
    expect(xProductHeaders.every((h) => h === 'ALERTPORT' || h === 'ALL')).toBe(true);
  });
});
