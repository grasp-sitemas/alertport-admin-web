import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('renders login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('AlertPort')).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha|password|contraseña/i)).toBeVisible();
  });

  test('shows validation errors when submitting empty', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /entrar|sign in|ingresar|ログイン|登录/i }).click();
    await expect(page.locator('text=/obrigatório|required|obligatorio|必須|必填/i').first()).toBeVisible();
  });

  test('unauthenticated user is redirected from root', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});
