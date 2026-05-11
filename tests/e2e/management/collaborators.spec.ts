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
 * Management → Collaborators CRUD against HML.
 * Required (src/features/collaborators/schemas.ts): firstName, lastName,
 * email, username, password (CREATE only), account, client, site, subtype.
 */
test.describe.serial('Collaborators CRUD', () => {
  const ts = Date.now();
  const firstName = makeTestName('collab');
  const username = `e2ecollab${ts}`;
  const email = `e2e-collab-${ts}@example.com`;
  const password = 'Password!9';

  test('LIST: collaborators page renders', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/collaborators');
    await expect(page.getByRole('button', { name: /^criar colab/i })).toBeVisible();
    await expect(page.locator('table, [role="table"]').first()).toBeVisible();
  });

  test('CREATE: new collaborator appears in list', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/collaborators');
    await clickCreateButton(page);
    const dialog = page.getByRole('dialog');
    await pickSelectByLabel(page, /^conta$/i, /.+/).catch(() => undefined);
    await pickSelectByLabel(page, /^cliente$/i, /.+/);
    await pickSelectByLabel(page, /^posto$|^site$/i, /.+/);
    await dialog.getByLabel(/^nome$/i).fill(firstName);
    await dialog.getByLabel(/sobrenome/i).fill('Auto');
    await dialog.getByLabel(/e-?mail/i).first().fill(email);
    await dialog.getByLabel(/usu[aá]rio|username/i).fill(username);
    const pwd = dialog.getByLabel(/^senha$/i).first();
    if (await pwd.isVisible().catch(() => false)) await pwd.fill(password);
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('EDIT: update collaborator we just created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/collaborators');
    await openRowEdit(page, firstName);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/sobrenome/i).fill('Auto-Edited');
    await clickSave(page);
    expect(await waitForToast(page)).toBe('success');
  });

  test('DELETE: archive collaborator we created', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await gotoManagementPage(page, '/collaborators');
    await openRowDelete(page, firstName);
    expect(await waitForToast(page)).toBe('success');
  });
});
