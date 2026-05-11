/**
 * Attendance flow E2E — verifies the two regressions reported by Flávio
 * 2026-05 are gone:
 *
 *   1. After closing an attendance the monitor list refreshes on its own
 *      (no manual F5).
 *   2. After closing one attendance, opening a second event and selecting
 *      an attendance type does NOT leave the "Adicionar" button disabled.
 *
 * Both scenarios are resilient: if HML doesn't have actionable
 * occurrences at run time, the relevant test is skipped with a clear
 * reason rather than failing red.
 *
 * Real-credentials login against admin-alertport-hml.vercel.app — driven
 * by PLAYWRIGHT_BASE_URL + PLAYWRIGHT_TEST_EMAIL/PASSWORD.
 */

import { test, expect, type Locator, type Page } from '@playwright/test';
import { loginToHml } from '../fixtures/auth.fixture';

test.describe.configure({ mode: 'serial' });

const ATTEND_BUTTON_RE = /atender|attend|atender ahora|対応|处理/i;
const CLOSE_ATTENDANCE_RE =
  /fechar atendimento|close attendance|cerrar atención|対応を終了|关闭处理/i;
const ADD_RECORD_RE = /salvar registro|save record|guardar registro|登録|保存记录/i;

async function gotoMonitor(page: Page): Promise<void> {
  await loginToHml(page);
  await page.goto('/alerts/monitor');
  await page.waitForLoadState('networkidle');
}

async function getMonitorCard(page: Page): Promise<Locator> {
  const card = page.locator('[data-tour="monitor-events"]');
  await expect(card).toBeVisible();
  return card;
}

async function countAttendButtons(card: Locator): Promise<number> {
  return card
    .getByRole('button', { name: ATTEND_BUTTON_RE })
    .count()
    .catch(() => 0);
}

test.describe('Attendance flow (HML)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoMonitor(page);
  });

  test('closing an attendance refreshes the monitor list without manual refresh', async ({
    page,
  }) => {
    const card = await getMonitorCard(page);
    const attendBtn = card.getByRole('button', { name: ATTEND_BUTTON_RE }).first();
    const hasButton = await attendBtn.isVisible().catch(() => false);
    test.skip(
      !hasButton,
      'HML monitor has no actionable events; cannot exercise attendance close flow.',
    );

    await attendBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Need at least one record before the close button is enabled. If
    // we can't add one (no operator privileges on the seeded HML user),
    // skip cleanly.
    const typeSelect = dialog.locator('[role="combobox"]').first();
    const canPickType = await typeSelect.isVisible().catch(() => false);
    if (canPickType) {
      await typeSelect.click().catch(() => {});
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible().catch(() => false)) {
        await firstOption.click();
        const addBtn = dialog.getByRole('button', { name: ADD_RECORD_RE });
        if (await addBtn.isEnabled().catch(() => false)) {
          await addBtn.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }

    const closeBtn = dialog.getByRole('button', { name: CLOSE_ATTENDANCE_RE });
    const closeReady = await closeBtn.isEnabled().catch(() => false);
    test.skip(
      !closeReady,
      'Close attendance button not enabled (likely non-OPERATOR session on HML).',
    );

    const buttonsBefore = await countAttendButtons(card);
    await closeBtn.click();

    // Dialog should auto-close after the mutation succeeds.
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // The monitor must refetch without a manual reload. We assert the
    // "Atender" button count for THIS specific event went down or the
    // total changed — without forcing F5.
    await page.waitForLoadState('networkidle');
    await expect
      .poll(async () => countAttendButtons(card), { timeout: 10_000 })
      .not.toBe(buttonsBefore);
  });

  test('opening a second event after close leaves Adicionar enabled once a type is selected', async ({
    page,
  }) => {
    const card = await getMonitorCard(page);
    const attendButtons = card.getByRole('button', { name: ATTEND_BUTTON_RE });
    const buttonCount = await attendButtons.count();
    test.skip(
      buttonCount < 2,
      'HML needs at least 2 actionable events to exercise the second-open regression.',
    );

    // First open + immediate close (no record) to mimic the original
    // bug: dialog state shouldn't bleed into the next opening.
    await attendButtons.first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Open a different event.
    await attendButtons.nth(1).click();
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const typeSelect = dialog.locator('[role="combobox"]').first();
    const canPickType = await typeSelect.isVisible().catch(() => false);
    test.skip(!canPickType, 'Attendance type select not rendered on second open.');

    await typeSelect.click();
    const firstOption = page.locator('[role="option"]').first();
    await expect(firstOption).toBeVisible({ timeout: 5_000 });
    await firstOption.click();

    const addBtn = dialog.getByRole('button', { name: ADD_RECORD_RE });
    // The whole bug: this used to stay disabled until F5. Poll because
    // selecting an option can re-render asynchronously.
    await expect
      .poll(async () => addBtn.isEnabled().catch(() => false), { timeout: 5_000 })
      .toBe(true);

    await page.keyboard.press('Escape');
  });
});
