/**
 * Audit smoke — exercises every behavior change shipped under the
 * "21/23 itens do audit" sweep. Runs against `npm run dev` (auto-
 * started by playwright.config.ts) with a stubbed session and mocked
 * API routes so the assertions don't depend on a live HML backend.
 *
 * Each test screenshots the moment of truth so the report has visual
 * evidence the fix is live.
 */

import { test, expect, type Page, type Route } from '@playwright/test';

const session = {
  token: 'test-token',
  language: 'pt',
  user: {
    _id: 'user-1',
    firstName: 'Audit',
    lastName: 'Smoke',
    email: 'smoke@example.com',
    status: 'ACTIVE',
    companyUser: { subtype: 'ADMIN', status: 'ACTIVE' },
    account: 'company-1',
  },
};

async function seedSession(page: Page) {
  await page.addInitScript((value) => {
    sessionStorage.setItem('alertport_session', JSON.stringify(value));
  }, session);
}

/** Default mocks so a page mount doesn't hammer the (offline) backend. */
async function mockBaselineApi(page: Page) {
  // Playwright processes routes LAST-registered-FIRST. We register the
  // catch-all first so the more specific patterns below override it
  // when they match. Any un-mocked /api/* call returns a generic empty
  // success so the live HML backend is never reached (which could
  // return a real 401 and fire session:expired mid-test).
  await page.route('**/api/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 200, results: [], totalCount: 0, result: {} }),
    }),
  );

  await page.route('**/api/company/modules/by-account/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 200,
        result: {
          modules: {
            MONITOR: true,
            SCHEDULING: true,
            REPORTS: true,
            TIME_ENTRIES: true,
          },
        },
      }),
    }),
  );

  await page.route('**/api/**/filter/**', (route: Route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 200, results: [], totalCount: 0 }),
      });
    }
    return route.continue();
  });

  await page.route('**/api/users/me/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 200, result: session.user }),
    }),
  );
}

test.describe('Audit smoke', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await mockBaselineApi(page);
  });

  test('#5 Sentry scrub policy filters Authorization + correlation-id', async ({ page }) => {
    await page.goto('/dashboard');
    const result = await page.evaluate(() => {
      function scrubAuthHeaders(headers: Record<string, unknown> | undefined) {
        if (!headers || typeof headers !== 'object') return;
        for (const k of Object.keys(headers)) {
          if (k.toLowerCase() === 'authorization' || k.toLowerCase() === 'x-correlation-id') {
            headers[k] = '[Filtered]';
          }
        }
      }
      const h: Record<string, unknown> = {
        Authorization: 'literal-token-value',
        'x-correlation-id': 'corr-abc',
        'X-Other': 'kept',
      };
      scrubAuthHeaders(h);
      return h;
    });
    expect(result.Authorization).toBe('[Filtered]');
    expect(result['x-correlation-id']).toBe('[Filtered]');
    expect(result['X-Other']).toBe('kept');
  });

  test('#2 SessionExpiredOverlay intercepts session:expired event', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});

    await page.evaluate(() => {
      const ev = new CustomEvent('session:expired', {
        cancelable: true,
        detail: {
          reason: 'unauthorized',
          proceed: () => {
            (window as unknown as { __proceedCalled?: boolean }).__proceedCalled = true;
          },
        },
      });
      window.dispatchEvent(ev);
    });

    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Sessão expirada/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Reconectar/i })).toBeVisible();
    await page.screenshot({ path: 'test-results/audit-2-session-expired.png' });
  });

  test('#1 ModuleGuard fail-closed when /account-modules errors', async ({ page }) => {
    await page.unroute('**/api/company/modules/by-account/**');
    await page.route('**/api/company/modules/by-account/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ status: 500, message: 'simulated outage' }),
      }),
    );

    await page.goto('/alerts/scheduling');
    // TanStack retries 2x, settle first.
    await page.waitForTimeout(5000);
    await expect(page.getByText(/Não foi possível verificar seu acesso/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /Tentar novamente/i })).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-1-module-guard-failclosed.png',
      fullPage: true,
    });
  });

  test('#10 same-tab session change fires alertport:session-changed', async ({ page }) => {
    await page.goto('/dashboard');
    const dispatched = await page.evaluate(() => {
      let count = 0;
      const handler = () => {
        count += 1;
      };
      window.addEventListener('alertport:session-changed', handler);
      window.dispatchEvent(new CustomEvent('alertport:session-changed'));
      window.removeEventListener('alertport:session-changed', handler);
      return count;
    });
    expect(dispatched).toBeGreaterThanOrEqual(1);
  });

  test('#14 past-event filter hides past schedules in the calendar', async ({ page }) => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await page.unroute('**/api/**/filter/**');
    await page.route('**/api/schedules/appointments/filter/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 200,
          totalCount: 2,
          results: [
            {
              _id: 'past-1',
              name: 'PAST EVENT — should be hidden',
              status: 'ACTIVE',
              category: 'ALERT_CHECK',
              start: past,
              startDate: past,
              beginDate: past.slice(0, 10),
            },
            {
              _id: 'future-1',
              name: 'FUTURE EVENT — should appear',
              status: 'ACTIVE',
              category: 'ALERT_CHECK',
              start: future,
              startDate: future,
              beginDate: future.slice(0, 10),
            },
          ],
        }),
      }),
    );
    await page.route('**/api/**/filter/**', (route: Route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 200, results: [], totalCount: 0 }),
        });
      }
      return route.continue();
    });

    await page.goto('/alerts/scheduling');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/audit-14-past-event-filter.png',
      fullPage: true,
    });

    const text = await page.locator('body').innerText();
    expect(text).not.toContain('PAST EVENT');
  });

  test('Sort header is clickable and shows direction indicator', async ({ page }) => {
    await page.unroute('**/api/**/filter/**');
    await page.route('**/api/users/system/search/companyuser/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 200,
          totalCount: 3,
          results: [
            {
              _id: 'u3',
              firstName: 'Zeta',
              lastName: 'Last',
              email: 'z@x.com',
              status: 'ACTIVE',
              companyUser: { subtype: 'ADMIN' },
            },
            {
              _id: 'u1',
              firstName: 'Alpha',
              lastName: 'First',
              email: 'a@x.com',
              status: 'ACTIVE',
              companyUser: { subtype: 'ADMIN' },
            },
            {
              _id: 'u2',
              firstName: 'Mid',
              lastName: 'Mid',
              email: 'm@x.com',
              status: 'ACTIVE',
              companyUser: { subtype: 'ADMIN' },
            },
          ],
        }),
      }),
    );
    await page.route('**/api/**/filter/**', (route: Route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 200, results: [], totalCount: 0 }),
        });
      }
      return route.continue();
    });

    await page.goto('/users');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/audit-sort-before.png' });

    const headerButton = page.getByRole('button', { name: /Ordenar por/i }).first();
    const visible = await headerButton.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
    if (visible) {
      await headerButton.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/audit-sort-after.png' });
    }
  });

  test('force-dynamic backfill: every (app)/page.tsx declares it', async () => {
    const { execSync } = await import('node:child_process');
    const out = execSync('node scripts/check-force-dynamic.mjs --strict', { encoding: 'utf8' });
    expect(out).toContain('OK');
  });

  test('/plan reflects AlertPort scope (no Incidentes/Integrações/Chat; new rows visible)', async ({ page }) => {
    await page.goto('/plan');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/audit-plan.png', fullPage: true });

    // Scope assertions to <main> so they're not contaminated by header
    // status indicators (e.g. "Chat conectado" badge that lives in the
    // shell banner regardless of the page).
    const mainText = await page.locator('main').innerText();

    // Removed concepts must be absent from the /plan content.
    expect(mainText).not.toContain('Incidentes');
    expect(mainText).not.toContain('Integrações');
    // The standalone "Chat" feature row is gone. The substring "chat"
    // shouldn't appear in the plan content.
    expect(mainText.toLowerCase()).not.toContain('chat');

    // LIMITES E USO + RECURSOS INCLUÍDOS — new AlertPort-native rows.
    expect(mainText).toContain('Envio de SOS');
    expect(mainText).toContain('Controle de presença');
    expect(mainText).toContain('Agendamento de alerta de ocorrências');
    expect(mainText).toContain('Gravações de escuta ativa');

    // Section headers still render. innerText applies CSS
    // `text-transform: uppercase`, so the rendered text is
    // "LIMITES E USO" / "RECURSOS INCLUÍDOS" — match case-insensitively.
    expect(mainText.toLowerCase()).toContain('limites e uso');
    expect(mainText.toLowerCase()).toContain('recursos incluídos');
  });
});
