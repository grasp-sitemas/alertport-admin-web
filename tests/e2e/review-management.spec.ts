import { test, expect, type Page, type Request } from '@playwright/test';
import { seedSession, mockApi, envelope, single, adminSession, sampleAccount, sampleClient, sampleSite, sampleEquipment } from './fixtures/session';

const errorsByPage = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(errorsByPage.get(page), 'uncaught browser errors').toEqual([]);
});

function multipartPayload(request: Request): Record<string, unknown> {
  const json = request.postData()?.match(/name="jsonData"\r\n\r\n([\s\S]*?)\r\n--/)?.[1];
  expect(json, 'mutation must contain the real multipart jsonData field').toBeTruthy();
  return JSON.parse(json!);
}

async function select(page: Page, label: string, option: string) {
  const container = page.getByRole('dialog').locator('div.space-y-2').filter({ has: page.locator('label').filter({ hasText: new RegExp(`^${label}$`) }) }).first();
  await container.getByRole('combobox').click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

for (const role of ['ADMIN', 'MANAGER']) {
  test(`${role} client actions match the assignable scope`, async ({ page }) => {
    await seedSession(page, { ...adminSession, user: { ...adminSession.user, companyUser: { ...adminSession.user.companyUser, subtype: role } } });
    await mockApi(page, { '/api/company/filter/v1/': envelope([sampleClient]) });
    await page.goto('/clients');
    const saved = page.getByRole('row').filter({ hasText: sampleClient.name });
    await expect(saved.getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar Cliente', exact: true })).toHaveCount(role === 'ADMIN' ? 1 : 0);
  });
}

test('users retain the legacy name when split name fields are absent', async ({ page }) => {
  await seedSession(page);
  await mockApi(page, {
    '/api/users/system/search/companyuser/v1/': envelope([
      { _id: 'legacy-user', name: 'Operador legado QA', email: 'legacy@example.invalid', status: 'ACTIVE', companyUser: { subtype: 'OPERATOR' } },
    ]),
  });
  await page.goto('/users');
  await expect(page.getByRole('row').filter({ hasText: 'legacy@example.invalid' })).toContainText('Operador legado QA');
  await page.getByRole('row').filter({ hasText: 'legacy@example.invalid' }).getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByRole('dialog')).toContainText('Operador legado QA');
});

test('company load failure is explicit and can recover without showing an empty record', async ({ page }) => {
  await seedSession(page);
  await mockApi(page, {});
  let unavailable = true;
  await page.route('**/api/users/system/companyuser/me/v1', route => unavailable
    ? route.fulfill({ status: 400, json: { status: 400, message: 'Fixture unavailable' } })
    : route.fulfill({ json: single({ ...adminSession.user, account: sampleAccount }) }));
  await page.goto('/company');
  await expect(page.locator('main').getByRole('alert')).toContainText('Ocorreu um erro');
  await expect(page.getByText('Nenhum dado disponível', { exact: true })).not.toBeVisible();
  unavailable = false;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.locator('input[name="name"]')).toHaveValue(sampleAccount.name);
  await expect(page.locator('main').getByRole('alert')).not.toBeVisible();
});

test('company save refreshes the list and reopens all persisted values', async ({ page }) => {
  await seedSession(page, { ...adminSession, user: { ...adminSession.user, companyUser: { ...adminSession.user.companyUser, subtype: 'SUPER_ADMIN_MASTER' } } });
  let stored: Record<string, unknown> = { ...sampleAccount, timezone: 'America/Sao_Paulo' };
  let writes = 0;
  await mockApi(page, {});
  await page.route('**/api/company/filter/v1/', route => route.fulfill({ json: envelope([stored]) }));
  await page.route(`**/api/company/formdata/v1/${sampleAccount._id}`, async route => {
    expect(route.request().method()).toBe('PUT');
    const payload = multipartPayload(route.request());
    stored = { ...stored, ...payload };
    writes += 1;
    await route.fulfill({ json: single(stored) });
  });
  await page.goto('/companies');
  await page.getByRole('button', { name: 'Editar Empresa', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="name"]').fill('Empresa revisada');
  await dialog.locator('input[name="fantasyName"]').fill('Fantasia revisada');
  await dialog.locator('input[name="document"]').fill('11222333000181');
  await dialog.locator('input[name="email"]').fill('review@example.com');
  await dialog.getByPlaceholder('(11) 99999-9999').fill('11987654321');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Empresa revisada', { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  expect(stored).toMatchObject({ name: 'Empresa revisada', fantasyName: 'Fantasia revisada', document: '11222333000181', email: 'review@example.com', primaryPhone: '11987654321' });
  await page.getByRole('button', { name: 'Editar Empresa', exact: true }).first().click();
  await expect(dialog.locator('input[name="fantasyName"]')).toHaveValue('Fantasia revisada');
});

for (const [path, record] of [['clients', sampleClient], ['sites', sampleSite]] as const) {
  test(`${path} archive closes only after success and refreshes the active list`, async ({ page }) => {
    await seedSession(page);
    let archived = false;
    let deletes = 0;
    await mockApi(page, {});
    await page.route('**/api/company/filter/v1/', route => route.fulfill({ json: envelope(archived ? [] : [record]) }));
    await page.route(`**/api/company/v1/${record._id}`, async route => {
      expect(route.request().method()).toBe('DELETE');
      expect(route.request().postDataJSON()).toEqual({ _id: record._id });
      archived = true;
      deletes += 1;
      await route.fulfill({ json: single({ ...record, status: 'ARCHIVED' }) });
    });
    await page.goto(`/${path}`);
    await page.getByRole('button', { name: 'Excluir', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(record.name, { exact: true })).not.toBeVisible();
    expect(deletes).toBe(1);
  });
}

test('an archive timeout preserves the record, reports failure and is never replayed automatically', async ({ page }) => {
  await seedSession(page);
  let attempts = 0;
  await mockApi(page, { '/api/company/filter/v1/': envelope([sampleClient]) });
  await page.route(`**/api/company/v1/${sampleClient._id}`, async route => {
    attempts += 1;
    await route.abort('timedout');
  });
  await page.goto('/clients');
  await page.getByRole('button', { name: 'Excluir', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirmar', exact: true })).toBeEnabled();
  await expect(page.locator('tr').filter({ hasText: sampleClient.name })).toBeVisible();
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).not.toBeVisible();
  expect(attempts).toBe(1);
});

for (const [role, label] of [['ADMIN', 'Administrador'], ['MANAGER', 'Gerente'], ['OPERATOR', 'Operador'], ['AUDITOR', 'Auditor']] as const) {
  test(`user ${role} submits the required hierarchy and closes after a successful save`, async ({ page }) => {
    await seedSession(page);
    let saved: Record<string, unknown> | undefined;
    await mockApi(page, { '/api/company/filter/v1/': envelope([sampleAccount, sampleClient, sampleSite]) });
    await page.route('**/api/users/formdata/v1/', async route => {
      expect(route.request().method()).toBe('POST');
      saved = multipartPayload(route.request());
      await route.fulfill({ json: single({ _id: 'new-user', ...saved }) });
    });
    await page.goto('/users');
    await page.getByRole('button', { name: /criar usuário/i }).click();
    await select(page, 'Perfil', label);
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name="firstName"]').fill('Review');
    await dialog.locator('input[name="lastName"]').fill(role);
    await dialog.locator('input[name="email"]').fill(`review-${role.toLowerCase()}@example.com`);
    await dialog.locator('input[type="password"]').nth(0).fill('Review!8Secret');
    await dialog.locator('input[type="password"]').nth(1).fill('Review!8Secret');
    if (role !== 'ADMIN') await select(page, 'Cliente', 'E2E Client');
    if (role === 'OPERATOR' || role === 'AUDITOR') await select(page, 'Posto', 'E2E Site');
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(saved).toMatchObject({ type: 'USER-COMPANY', account: sampleAccount._id, companyUser: { subtype: role, status: 'ACTIVE' } });
    if (role !== 'ADMIN') expect(saved?.client).toBe(sampleClient._id);
  });
}

test('equipment Other options submit the exact catalog values', async ({ page }) => {
  await seedSession(page);
  let saved: Record<string, unknown> | undefined;
  await mockApi(page, {
    '/api/company/equipments/filter/v1/': envelope([sampleEquipment]),
    '/api/company/filter/v1/': envelope([sampleAccount, sampleClient, sampleSite]),
    '/api/helpers/data/equipments/types/v1/': envelope([{ _id: 'DEVICE-OTHER', name: 'str.helpers.equipments.types.DEVICE-OTHER' }]),
    '/api/helpers/data/equipments/brands/v1/': envelope([{ _id: 'OTHER', name: 'str.helpers.equipments.brands.OTHER' }]),
  });
  await page.route(`**/api/company/equipments/v1/${sampleEquipment._id}`, async route => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: single({ ...sampleEquipment, ...saved }) });
  });
  await page.goto('/equipment');
  await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
  await select(page, 'Tipo', 'Outro');
  await select(page, 'Marca', 'Outro');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(saved).toMatchObject({ type: 'DEVICE-OTHER', brand: 'OTHER' });
});

test('site CEP lookup is permitted by the delivered CSP and fills the form', async ({ page }) => {
  await seedSession(page);
  await mockApi(page, { '/api/company/filter/v1/': envelope([sampleAccount, sampleClient]) });
  await page.route('https://viacep.com.br/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' }),
  }));
  await page.goto('/sites');
  await page.getByRole('button', { name: /criar posto/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('00000-000').fill('01001-000');
  await expect(dialog.locator('input[name="address.address"]')).toHaveValue('Praça da Sé');
  await expect(dialog.locator('input[name="address.city"]')).toHaveValue('São Paulo');
  await expect(page.getByText('CEP inválido', { exact: true })).not.toBeVisible();
});
