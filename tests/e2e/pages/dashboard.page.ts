/**
 * DashboardPage POM.
 *
 * /dashboard is the universal post-login landing page (every role can
 * see it — `.claude/rules/roles-matrix.md`). The POM only asserts URL
 * and shell render; feature-specific UI lives in its own POM.
 */
import { expect, type Page } from '@playwright/test';
import { ROUTES } from '../helpers/selectors';

export class DashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.dashboard);
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${ROUTES.dashboard}(\\b|$)`));
  }
}
