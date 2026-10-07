import { test, expect } from '@playwright/test';
import {
  seedSession, mockApi, envelope, single, sampleAccount, sampleClient, sampleSite,
  sampleEquipment,
} from './fixtures/session';

// All credentials and records in these tests are synthetic. No live API writes.
test('login fallback never places credentials in the URL when JavaScript is unavailable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`);
  // Even a native fallback forced after hydration failure must use POST.
  await page.evaluate(() => {
    document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((input) => { input.disabled = false; });
  });
  await page.locator('input[name="email"]').fill('canary@example.invalid');
  await page.locator('input[name="password"]').fill('fake-canary-password');
  const submitted = page.waitForRequest((request) => request.isNavigationRequest());
  await page.route('**/login**', (route) => route.abort());
  await page.locator('button[type="submit"]').click();
  const request = await submitted;
  expect(new URL(request.url()).search).toBe('');
  expect(request.method()).toBe('POST');
  await context.close();
});

test('valid CEP fills the address under the actual browser CSP without sending the session token', async ({ page }) => {
  await seedSession(page);
  await mockApi(page, {
    '/api/users/system/companyuser/me/v1': single({ account: sampleAccount, companyUser: { subtype: 'ADMIN' } }),
  });
  let headers: Record<string, string> | undefined;
  await page.route('https://viacep.com.br/**', async (route) => {
    headers = route.request().headers();
    await route.fulfill({ json: { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' } });
  });
  await page.goto('/company');
  await expect(page.locator('input[name="name"]')).toHaveValue(sampleAccount.name);
  await page.getByPlaceholder('00000-000').fill('01001-000');
  await page.getByPlaceholder('00000-000').blur();
  await expect(page.locator('input[name="address.address"]')).toHaveValue('Praça da Sé');
  await expect(page.locator('input[name="address.city"]')).toHaveValue('São Paulo');
  expect(headers).toBeDefined();
  expect(headers).not.toHaveProperty('authorization');
});

test('clearing company fantasy name sends an explicit empty value and remains clear after reload', async ({ page }) => {
  await seedSession(page);
  await mockApi(page, {});
  let account = { ...sampleAccount };
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/users/system/companyuser/me/v1', (route) => route.fulfill({ json: single({ account, companyUser: { subtype: 'ADMIN' } }) }));
  await page.route('**/api/company/formdata/v1/*', async (route) => {
    const match = /name="jsonData"\r\n\r\n([^\r]+)/.exec(route.request().postData() ?? '');
    submitted = JSON.parse(match![1]);
    account = { ...account, ...submitted };
    await route.fulfill({ json: single(account) });
  });
  await page.goto('/company');
  await expect(page.locator('input[name="fantasyName"]')).toHaveValue('E2E');
  await page.locator('input[name="fantasyName"]').fill('');
  await page.getByRole('button', { name: /^salvar/i }).click();
  await expect.poll(() => submitted).toBeDefined();
  expect(submitted).toHaveProperty('fantasyName', '');
  await page.reload();
  await expect(page.locator('input[name="name"]')).toHaveValue(sampleAccount.name);
  await expect(page.locator('input[name="fantasyName"]')).toHaveValue('');
});

for (const mode of ['occurrence', 'series']) {
  test(`editing ${mode} keeps saved equipment after delayed schedule and options arrive`, async ({ page }) => {
    await seedSession(page);
    const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const schedule = {
      _id: 'schedule-1', name: 'QA schedule', account: sampleAccount._id,
      client: sampleClient._id, site: sampleSite._id, equipment: sampleEquipment._id,
      frequency: 'DAILY', category: 'ALERT_CHECK', beginDate: day, endDate: day,
      beginHour: '09:00', endHour: '18:00', status: 'ACTIVE',
      alertConfig: { alertType: 'FIXED', fixedInterval: 30, durationMin: 2, volumeLevel: 80 },
    };
    await mockApi(page, {
      '/api/schedules/appointments/filter/v2/': envelope([{ ...schedule, _id: 'appointment-1', schedule: 'schedule-1', equipment: undefined, startDate: `${day}T12:00:00Z` }]),
      '/api/company/filter/v1/': envelope([sampleAccount, sampleClient, sampleSite]),
    });
    await page.route('**/api/schedules/v1/schedule-1', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ json: single(schedule) });
    });
    await page.route('**/api/company/equipments/filter/v1/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.fulfill({ json: envelope([sampleEquipment]) });
    });
    let submitted: Record<string, unknown> | undefined;
    await page.route(/\/api\/schedules\/.*\/update\//, async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ json: single(schedule) });
    });
    await page.goto('/alerts/scheduling');
    await page.locator('.fc-event').filter({ hasText: 'QA schedule' }).first().click();
    await page.getByRole('button', { name: mode === 'series' ? /editar toda a série/i : /editar esta ocorrência/i }).click();
    await expect(page.getByTestId('schedule-equipment-trigger')).toContainText(sampleEquipment.code);
    await page.getByRole('dialog').getByRole('button', { name: /^salvar$/i }).click();
    await expect.poll(() => submitted).toBeDefined();
    expect(submitted).toHaveProperty('equipment', sampleEquipment._id);
  });
}

test('monitor window uses the published settings route and persists after reopening', async ({ page }) => {
  await seedSession(page);
  await mockApi(page, {
    '/api/users/system/companyuser/me/v1': single({ account: sampleAccount, companyUser: { subtype: 'ADMIN' } }),
  });
  let hours = 24;
  const settings = () => single({ _id: 'settings-1', account: sampleAccount._id, status: 'ACTIVE', monitor: { eventFilters: [{ type: 'SOS_ALERT', enabled: true }], eventTimeWindowHours: hours, callRecordingEnabled: false } });
  await page.route('**/api/company/settings/me/v1/', (route) => route.fulfill({ json: settings() }));
  await page.route('**/api/company/settings/v1/**', async (route) => {
    if (!new URL(route.request().url()).pathname.endsWith('/settings/v1/')) {
      await route.fulfill({ status: 404, json: { status: 404 } });
      return;
    }
    expect(route.request().method()).toBe('PUT');
    hours = route.request().postDataJSON().monitor.eventTimeWindowHours;
    await route.fulfill({ json: settings() });
  });
  await page.goto('/company');
  await page.getByRole('button', { name: /configurações do monitor/i }).click();
  await expect(page.locator('#eventTimeWindowHours')).toHaveValue('24');
  await page.locator('#eventTimeWindowHours').fill('1');
  await page.getByRole('dialog').getByRole('button', { name: /^salvar$/i }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(hours).toBe(1);
  await page.getByRole('button', { name: /configurações do monitor/i }).click();
  await expect(page.locator('#eventTimeWindowHours')).toHaveValue('1');
});

for (const role of ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER']) {
  test(`${role} can access company details but cannot submit ADMIN-only monitor settings`, async ({ page }) => {
    const { adminSession } = await import('./fixtures/session');
    const user = { ...adminSession.user, companyUser: { ...adminSession.user.companyUser, subtype: role } };
    await seedSession(page, { ...adminSession, user });
    await mockApi(page, {
      '/api/users/system/companyuser/me/v1': single({ ...user, account: sampleAccount }),
    });
    await page.goto('/company');
    await expect(page.locator('input[name="name"]')).toHaveValue(sampleAccount.name);
    await expect(page.getByRole('button', { name: /configurações do monitor/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^salvar/i })).toBeVisible();
  });
}
