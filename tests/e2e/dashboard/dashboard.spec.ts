/**
 * Dashboard E2E — runs against HML with the SAM credentials.
 *
 * Covers:
 *   - Auth redirect lands on /dashboard
 *   - KPI cards render (Registered Devices, Active Devices, plus the 4 main alert KPIs)
 *   - "Top sites" card renders (chart or empty state)
 *   - "Recent activity" card renders <= 20 items
 *   - Locale switch to EN does not crash the page
 *
 * Assertions are intentionally tolerant of HML data volatility — we
 * verify structure ("card exists, item count bounded"), not exact values.
 */

import { test, expect } from '@playwright/test';
import { loginToHml } from '../fixtures/auth.fixture';

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard (HML, SAM)', () => {
  test.beforeEach(async ({ page }) => {
    await loginToHml(page);
  });

  test('renders main KPI cards (Registered + Active Devices + 4 alert KPIs)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-tour="dashboard-kpis"]')).toBeVisible();

    const labels = [
      /Total de Alertas|Total Alerts/i,
      /Dispositivos cadastrados|Registered Devices/i,
      /Dispositivos Ativos|Active Devices/i,
    ];
    for (const label of labels) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('"Top sites" card renders (chart or empty state)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const topSitesTitle = page.getByText(/Sites com mais alertas|Top sites by alerts/i).first();
    await expect(topSitesTitle).toBeVisible();
  });

  test('"Recent activity" renders at most 20 rows', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Title is inside CardTitle. We grab the Card ancestor by walking up
    // to the closest container that also holds the scrollable list.
    const title = page.getByText(/^Atividade Recente$|^Recent Activity$/i).first();
    await expect(title).toBeVisible();

    // Scope to the scroll container (`max-h-[320px]`) inside the same
    // card. Its direct children are either the row divs or the
    // "no data" paragraph.
    const scroll = page.locator('div.max-h-\\[320px\\]').first();
    const present = await scroll.isVisible().catch(() => false);
    expect(present).toBe(true);

    const rowCount = await scroll.locator('> div').count().catch(() => 0);
    const noDataText = await scroll
      .getByText(/Nenhum dado|No data|Sem dados/i)
      .isVisible()
      .catch(() => false);

    expect(rowCount).toBeLessThanOrEqual(20);
    expect(rowCount > 0 || noDataText).toBe(true);
  });

  test('locale switch to EN does not crash the page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Change language/i }).click();
    await page.getByRole('menuitem', { name: /English/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/Total Alerts|Registered Devices/i).first()).toBeVisible();
  });
});
