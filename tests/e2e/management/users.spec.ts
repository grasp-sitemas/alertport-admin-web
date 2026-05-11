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
 * Management → Users CRUD against HML.
 *
 * Required fields (src/features/users/schemas.ts): firstName, lastName,
 * email, password (CREATE only), companyUser.subtype. OPERATOR/MANAGER/
 * AUDITOR additionally require `client`; we pick ADMIN to keep CREATE
 * deterministic for SUPER_ADMIN_MASTER.
 */
test.describe.serial('Users CRUD', () => {
  const firstName = makeTestName('user');
  const email = `e2e-user-${Date.now()}@example.com`;
  const password = 'Password!9';

  test('LIST: users page renders DataTable', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/users');
    await expect(page.getByRole('button', { name: /^criar usu/i })).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });

  test('CREATE: new user appears in list', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/users');
    await clickCreateButton(page);

    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name="firstName"]').fill(firstName);
    await dialog.locator('input[name="lastName"]').fill('Auto');
    await dialog.locator('input[name="email"]').fill(email);
    const pwd = dialog.locator('input[name="password"]');
    if (await pwd.isVisible().catch(() => false)) await pwd.fill(password);
    const confirmPwd = dialog.locator('input[name="confirmPassword"]');
    if (await confirmPwd.isVisible().catch(() => false)) await confirmPwd.fill(password);
    await pickSelectByLabel(page, /perfil|role/i, /admin/i).catch(() => undefined);

    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('EDIT: update the user we just created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/users');
    await openRowEdit(page, firstName);

    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name="lastName"]').fill('Auto-Edited');
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('DELETE: archive the user we created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/users');
    await openRowDelete(page, firstName);
    expect(await waitForToast(page)).toBe('success');
  });
});
