import { test, expect } from '@playwright/test';

const session = {
  token: 'test-token',
  language: 'pt',
  user: {
    _id: 'user-1',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    status: 'ACTIVE',
    companyUser: {
      subtype: 'ADMIN',
      status: 'ACTIVE',
    },
    account: 'company-1',
  },
};

test.describe('Critical admin routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((value) => {
      sessionStorage.setItem('alertport_session', JSON.stringify(value));
    }, session);
  });

  test('loads scheduling even with incomplete API data', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text());
      }
    });

    await page.route('**/api/schedules/appointments/filter/v2/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 200,
          results: [
            {
              _id: 'schedule-1',
              name: 'Fallback schedule',
              status: 'ACTIVE',
              category: 'ALERT_CHECK',
              beginDate: '2026-04-16',
              beginHour: undefined,
              endHour: undefined,
              alertConfig: undefined,
            },
          ],
          totalCount: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto('/alerts/scheduling');
    await expect(page.getByRole('heading', { name: /agendamento de alertas|alert scheduling/i })).toBeVisible();
    await expect(page.getByText('Fallback schedule')).toBeVisible();
    await expect(page.getByRole('cell', { name: '- – -' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('loads company page with company data', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text());
      }
    });

    await page.route('**/api/company/v1/company-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 200,
          result: {
            _id: 'company-1',
            name: 'AlertPort Holdings',
            fantasyName: 'AlertPort',
            personType: 'LEGAL',
            document: '00.000.000/0001-00',
            email: 'company@example.com',
            primaryPhone: '(11) 99999-0000',
            status: 'ACTIVE',
            address: {
              cep: '01000-000',
              address: 'Rua Central',
              number: '100',
              neighborhood: 'Centro',
              city: 'São Paulo',
              state: 'SP',
              country: 'BR',
            },
          },
        }),
      });
    });

    await page.goto('/company');
    await expect(page.getByRole('heading', { name: /informações da empresa|company info/i })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
