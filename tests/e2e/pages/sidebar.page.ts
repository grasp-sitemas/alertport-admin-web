/**
 * SidebarPage POM.
 *
 * The sidebar renders on every authenticated page. Nav items are
 * role-gated by `src/config/navigation.ts`. Match by href, not by
 * text — labels are i18n and break under locale switch.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { SIDEBAR_SELECTORS } from '../helpers/selectors';

export class SidebarPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  linkByHref(href: string): Locator {
    return this.page.locator(`a[href$="${href}"]`).first();
  }

  get dashboardLink(): Locator {
    return this.linkByHref(SIDEBAR_SELECTORS.hrefs.dashboard);
  }

  /** Companies (platform-level) — only SUPER_ADMIN_MASTER sees this. */
  get companiesLink(): Locator {
    return this.linkByHref(SIDEBAR_SELECTORS.hrefs.companies);
  }

  get usersLink(): Locator {
    return this.linkByHref(SIDEBAR_SELECTORS.hrefs.users);
  }

  get schedulingLink(): Locator {
    return this.linkByHref(SIDEBAR_SELECTORS.hrefs.scheduling);
  }

  async expectVisible(): Promise<void> {
    await expect(this.dashboardLink).toBeVisible({ timeout: 15_000 });
  }

  async expectCompaniesHidden(): Promise<void> {
    await expect(this.companiesLink).toHaveCount(0);
  }

  async expectCompaniesVisible(): Promise<void> {
    await expect(this.companiesLink).toBeVisible();
  }

  /** Click the logout button (lives in header but conceptually nav). */
  async logout(): Promise<void> {
    const logoutButton = this.page
      .getByRole('button', { name: SIDEBAR_SELECTORS.logoutButton })
      .first();
    await logoutButton.click();
  }
}
