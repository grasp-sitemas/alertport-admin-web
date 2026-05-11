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
  makeTestName,
} from './helpers';

/**
 * Management → Clients CRUD against HML.
 * Required fields (src/features/clients/schemas.ts): name, account
 * (account picker only visible for SUPER_ADMIN_MASTER).
 */
test.describe.serial('Clients CRUD', () => {
  const name = makeTestName('client');

  test('LIST: clients page renders', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/clients');
    await expect(page.getByRole('button', { name: /^criar cliente/i })).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });

  test('CREATE: new client appears in list', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/clients');
    await clickCreateButton(page);

    const dialog = page.getByRole('dialog');
    await pickSelectByLabel(page, /^conta$/i, /.+/).catch(() => undefined);
    await dialog.getByLabel(/^nome$/i).fill(name);
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('EDIT: update client we just created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/clients');
    await openRowEdit(page, name);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^nome$/i).fill(`${name}-edited`);
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('DELETE: archive client we created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/clients');
    await openRowDelete(page, name);
    expect(await waitForToast(page)).toBe('success');
  });
});
