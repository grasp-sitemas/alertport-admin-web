/**
 * Sonner toast helpers.
 *
 * Sonner renders into a portal — `page.locator(TOAST_SELECTORS.toast)`
 * works from anywhere on the page. We expose three primitives so specs
 * stay readable:
 *   - expectSuccessToast: hard-assert a success toast surfaced
 *   - expectErrorToast: hard-assert an error toast surfaced
 *   - expectToastEither: accept success OR error (used when the HML
 *     backend is known-flaky and the frontend doing the mutation is
 *     all we can verify)
 */
import { expect, type Page } from '@playwright/test';
import { TOAST_SELECTORS } from './selectors';

const DEFAULT_TIMEOUT = 15_000;

interface ToastOptions {
  readonly timeout?: number;
  readonly message?: RegExp;
}

export async function expectSuccessToast(
  page: Page,
  options: ToastOptions = {},
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT, message } = options;
  const toast = page.locator(TOAST_SELECTORS.toastSuccess).first();
  await expect(toast).toBeVisible({ timeout });
  if (message) {
    await expect(toast).toContainText(message);
  }
}

export async function expectErrorToast(
  page: Page,
  options: ToastOptions = {},
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT, message } = options;
  const toast = page.locator(TOAST_SELECTORS.toastError).first();
  await expect(toast).toBeVisible({ timeout });
  if (message) {
    await expect(toast).toContainText(message);
  }
}

/**
 * Resolve as soon as EITHER a success or an error toast appears.
 *
 * Used for HML-flaky flows (cancel-series, edit-series) where the
 * frontend doing its job is verifiable but the backend may 500 or
 * hang. Returns which toast type fired for diagnostic logging.
 */
export async function expectToastEither(
  page: Page,
  options: { timeout?: number } = {},
): Promise<'success' | 'error'> {
  const { timeout = DEFAULT_TIMEOUT } = options;
  const success = page.locator(TOAST_SELECTORS.toastSuccess).first();
  const error = page.locator(TOAST_SELECTORS.toastError).first();

  await expect
    .poll(
      async () => {
        if (await success.isVisible().catch(() => false)) return 'success';
        if (await error.isVisible().catch(() => false)) return 'error';
        return 'pending';
      },
      { timeout, intervals: [250, 500, 1000] },
    )
    .not.toBe('pending');

  if (await success.isVisible().catch(() => false)) return 'success';
  return 'error';
}
