import { defineConfig, devices } from '@playwright/test';

// When PLAYWRIGHT_BASE_URL is set (e.g. running against HML), skip the
// local Next dev webServer — it would try to bind localhost:3000 and
// also requires Node 20+. Absolute URL specs hit HML directly.
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const isCi = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  // expect.timeout governs default `toBeVisible` etc. The previous 5s
  // default was too tight for HML cold starts; 15s matches the toast
  // helpers and keeps non-trivial assertions resilient without
  // masking actually-broken UI.
  expect: { timeout: 15_000 },
  // GitHub reporter when running in CI adds workflow annotations; the
  // HTML reporter is kept locally so `npx playwright show-report`
  // continues to work.
  reporter: isCi
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalBaseUrl || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: isCi ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !isCi,
          timeout: 120 * 1000,
        },
      }),
});
