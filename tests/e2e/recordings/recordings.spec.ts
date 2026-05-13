/**
 * Call Recordings E2E — runs against HML with the SAM credentials.
 *
 * Covers:
 *   - Page loads (list or empty state)
 *   - Date-range filter triggers POST /api/calls/recordings/filter/v1/
 *   - Playing a recording mounts an <audio> element; manual close X removes it
 *   - Auto-close on natural end (onEnded) — verified by dispatching `ended`
 *   - Source filtering (no ShieldGo recordings) — best-effort + manual-note
 */

import { test, expect, type Request } from '@playwright/test';
import { loginToHml } from '../fixtures/auth.fixture';

test.describe.configure({ mode: 'serial' });

test.describe('Call Recordings (HML, SAM)', () => {
  test.beforeEach(async ({ page }) => {
    await loginToHml(page);
    await page.goto('/alerts/recordings');
    await page.waitForLoadState('networkidle');
  });

  test('loads the recordings panel (list or empty state)', async ({ page }) => {
    await expect(page.getByText(/grava[çc][õo]es|recordings/i).first()).toBeVisible();
    const empty = page.getByText(/nenhuma grava|no recordings/i);
    const playBtn = page.getByRole('button', { name: /^reproduzir$|^play$/i }).first();
    const hasEmpty = await empty.isVisible().catch(() => false);
    const hasRow = await playBtn.isVisible().catch(() => false);
    expect(hasEmpty || hasRow).toBe(true);
  });

  test('date-range filter triggers the recordings filter endpoint', async ({ page }) => {
    const requests: Request[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/calls/recordings/filter/v1/')) requests.push(req);
    });

    const dateInputs = page.locator('input[type="date"]');
    const dateCount = await dateInputs.count();
    test.skip(dateCount < 2, 'Recordings page is missing date filter inputs in HML.');

    const today = new Date();
    const week = new Date(today);
    week.setDate(today.getDate() - 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    await dateInputs.nth(0).fill(fmt(week));
    await dateInputs.nth(1).fill(fmt(today));
    await page.waitForLoadState('networkidle');

    const searchBtn = page.getByRole('button', { name: /^buscar$|^search$/i }).first();
    if (await searchBtn.isVisible().catch(() => false)) {
      await searchBtn.click();
      await page.waitForLoadState('networkidle');
    }

    expect(requests.length).toBeGreaterThan(0);
  });

  test('play opens audio player; close X removes it', async ({ page }) => {
    const playBtn = page.getByRole('button', { name: /^reproduzir$|^play$/i }).first();
    const hasRecording = await playBtn.isVisible().catch(() => false);
    test.skip(!hasRecording, 'HML has no recordings to exercise the player.');

    await playBtn.click();
    const audio = page.locator('audio').first();
    await expect(audio).toBeVisible({ timeout: 10_000 });

    const closeBtn = page.getByRole('button', { name: /fechar|close|cerrar|閉じる|关闭/i }).first();
    await closeBtn.click();
    await expect(page.locator('audio')).toHaveCount(0, { timeout: 5_000 });
  });

  test('audio auto-closes when playback ends (onEnded handler)', async ({ page }) => {
    const playBtn = page.getByRole('button', { name: /^reproduzir$|^play$/i }).first();
    const hasRecording = await playBtn.isVisible().catch(() => false);
    test.skip(!hasRecording, 'HML has no recordings to exercise auto-close.');

    await playBtn.click();
    const audio = page.locator('audio').first();
    await expect(audio).toBeVisible({ timeout: 10_000 });

    await audio.evaluate((el) => {
      el.dispatchEvent(new Event('ended'));
    });

    await expect(page.locator('audio')).toHaveCount(0, { timeout: 5_000 });
  });

  test('only AlertPort-sourced recordings render (best-effort)', async ({ page }) => {
    // No discoverable `source` field on the row markup, so this is a
    // soft-assert + documented manual verification step. The backend
    // already filters via auto-scope; this test flags regressions if
    // ShieldGo branding ever leaks into the AlertPort tenant.
    const shieldgoLeak = page.getByText(/shieldgo/i);
    expect(await shieldgoLeak.count()).toBe(0);
  });
});
