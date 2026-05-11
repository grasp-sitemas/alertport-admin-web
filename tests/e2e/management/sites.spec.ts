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
 * Management → Sites CRUD against HML.
 * Required fields (src/features/sites/schemas.ts): name, client.
 * Address optional. We pick the first available client to satisfy FK.
 */
test.describe.serial('Sites CRUD', () => {
  const name = makeTestName('site');

  test('LIST: sites page renders', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/sites');
    await expect(page.getByRole('button', { name: /^criar posto|^criar site/i })).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });

  test('CREATE: new site appears in list', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/sites');
    await clickCreateButton(page);
    const dialog = page.getByRole('dialog');
    await pickSelectByLabel(page, /^conta$/i, /.+/).catch(() => undefined);
    await pickSelectByLabel(page, /^cliente$/i, /.+/);
    await dialog.getByLabel(/^nome$/i).fill(name);
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('EDIT: update site we just created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/sites');
    await openRowEdit(page, name);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/^nome$/i).fill(`${name}-edited`);
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('DELETE: archive site we created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/sites');
    await openRowDelete(page, name);
    expect(await waitForToast(page)).toBe('success');
  });
});
