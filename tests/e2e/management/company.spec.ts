import { test, expect } from '@playwright/test';
import {
  loginAsSuperAdmin,
  gotoManagementPage,
  clickSave,
  waitForToast,
} from './helpers';

/**
 * Management → Company (single account). No create/delete affordance —
 * only EDIT on the logged-in user's own account. We touch the optional
 * `fantasyName` field with a timestamped value to avoid corrupting the
 * required fields of the real HML account.
 */
test.describe.serial('Company (single account)', () => {
  test('LIST + EDIT: company page renders and Save works', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/company');

    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });

    const fantasy = page.locator('input[name="fantasyName"]');
    if (await fantasy.isVisible().catch(() => false)) {
      await fantasy.fill(`E2E Auto ${Date.now()}`);
    }

    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });
});
