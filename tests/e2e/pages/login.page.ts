/**
 * LoginPage POM.
 *
 * Wraps the HTML form on /login so specs stay declarative:
 *   const login = new LoginPage(page);
 *   await login.goto();
 *   await login.signIn(creds);
 *
 * No timing magic — the only thing this class does that isn't a
 * straight locator is `waitForRedirect()`, which we keep configurable
 * because HML auth-backend cold-starts can stretch past 30s.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { LOGIN_SELECTORS, ROUTES } from '../helpers/selectors';
import type { Credentials } from '../fixtures/credentials';

const DEFAULT_REDIRECT_TIMEOUT = 60_000;

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator(LOGIN_SELECTORS.emailInput).first();
    this.passwordInput = page.locator(LOGIN_SELECTORS.passwordInput).first();
    this.submitButton = page.getByRole('button', { name: LOGIN_SELECTORS.submitButton });
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.login);
    await expect(this.emailInput).toBeVisible();
  }

  async fill(credentials: Pick<Credentials, 'email' | 'password'>): Promise<void> {
    await this.emailInput.fill(credentials.email);
    await this.passwordInput.fill(credentials.password);
  }

  async submit(credentials: Pick<Credentials, 'email' | 'password'>): Promise<void> {
    await this.fill(credentials);
    await this.submitButton.click();
  }

  /**
   * Full happy-path: fill, submit, wait until the URL no longer
   * matches /login. Throws if redirect doesn't happen within the
   * configured timeout (usually wrong credential or cold-start).
   */
  async signIn(
    credentials: Pick<Credentials, 'email' | 'password'>,
    options: { redirectTimeout?: number } = {},
  ): Promise<void> {
    const { redirectTimeout = DEFAULT_REDIRECT_TIMEOUT } = options;
    await this.submit(credentials);
    await this.page.waitForURL((url) => !/\/login(\b|$)/.test(url.pathname), {
      timeout: redirectTimeout,
    });
  }
}
