import { test, expect } from '@playwright/test';
import { mockApi, sampleAccount, seedSession, single } from './fixtures/session';

test.describe('Critical admin routes', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('loads scheduling even with incomplete API data', async ({ page }) => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text());
      }
    });

    await mockApi(page, {
      '/api/schedules/appointments/filter/v2/': {
        status: 200,
        results: [
          {
            _id: 'schedule-1',
            name: 'Fallback schedule',
            status: 'ACTIVE',
            category: 'ALERT_CHECK',
            beginDate: futureDate,
            beginHour: undefined,
            endHour: undefined,
            alertConfig: undefined,
          },
        ],
        totalCount: 1,
        page: 1,
        limit: 20,
      },
    });

    await page.goto('/alerts/scheduling');
    await expect(
      page.getByRole('heading', { name: /agendamento de alertas|alert scheduling/i }),
    ).toBeVisible();
    const event = page.locator('.fc-event').filter({ hasText: 'Fallback schedule' });
    await expect(event).toBeVisible();
    await expect(event).toContainText('00:00');
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

    await mockApi(page, {
      '/api/users/system/companyuser/me/v1': single({
        ...sampleAccount,
        companyUser: { subtype: 'ADMIN', status: 'ACTIVE' },
        account: sampleAccount,
        company: sampleAccount,
      }),
      '/api/company/formdata/v1/': single(sampleAccount),
      '/api/address/geo/v1/': { status: 200, results: [] },
    });

    await page.goto('/company');
    await expect(
      page.getByRole('heading', { name: /informações da empresa|company info/i }),
    ).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
