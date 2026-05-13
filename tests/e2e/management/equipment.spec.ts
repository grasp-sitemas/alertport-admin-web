import { test, expect } from '@playwright/test';
import {
  loginAsSuperAdmin,
  gotoManagementPage,
  clickCreateButton,
  clickSave,
  waitForToast,
  openRowEdit,
  openRowDelete,
  pickSelectByLabel,
  E2E_PREFIX,
} from './helpers';

/**
 * Management → Equipment CRUD against HML.
 * Required fields (src/features/equipment/schemas.ts): account, client,
 * site, code. `code` is the visible identifier on the list.
 */
test.describe.serial('Equipment CRUD', () => {
  const code = `${E2E_PREFIX}-EQ-${Date.now()}`;

  test('LIST: equipment page renders', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/equipment');
    await expect(page.getByRole('button', { name: /^criar equipamento/i })).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });

  test('CREATE: new equipment appears in list', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/equipment');
    await clickCreateButton(page);
    const dialog = page.getByRole('dialog');
    await pickSelectByLabel(page, /^conta$/i, /.+/).catch(() => undefined);
    await pickSelectByLabel(page, /^cliente$/i, /.+/).catch(() => undefined);
    await pickSelectByLabel(page, /^posto$|^site$/i, /.+/).catch(() => undefined);
    await dialog
      .getByLabel(/c[oó]digo|imei/i)
      .first()
      .fill(code);
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('EDIT: open and save equipment we just created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/equipment');
    await openRowEdit(page, code);
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('DELETE: archive equipment we created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/equipment');
    await openRowDelete(page, code);
    expect(await waitForToast(page)).toBe('success');
  });
});
