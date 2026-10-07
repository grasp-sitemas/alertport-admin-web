import { test, expect } from '@playwright/test';

test('login cannot submit credentials before JavaScript hydration', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeDisabled();
    await expect(page.locator('input[type="password"]')).toBeDisabled();
    await expect(page.getByRole('button', { name: /^entrar$/i })).toBeDisabled();
    await expect(page.locator('form')).toHaveAttribute('method', 'post');
    expect(new URL(page.url()).search).toBe('');
  } finally {
    await context.close();
  }
});
