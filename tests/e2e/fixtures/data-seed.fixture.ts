/**
 * Data-seed fixture stub.
 *
 * HML data is shared, ephemeral, and prone to depletion. Real plan:
 * a seed endpoint that creates an isolated tenant per test run. For
 * now this file is a typed placeholder so future specs can import it
 * without churn when the real seed implementation lands.
 */
import { test as base } from '@playwright/test';

interface DataSeedFixtures {
  /**
   * Returns a unique-per-test prefix to embed in entity names so
   * concurrent runs don't collide. Format: `e2e-<timestamp>-<rand>`.
   */
  readonly seedPrefix: string;
}

export const test = base.extend<DataSeedFixtures>({
  seedPrefix: async ({}, provide) => {
    const prefix = `e2e-${Date.now()}-${Math.floor(Math.random() * 1_000)}`;
    await provide(prefix);
  },
});

export { expect } from '@playwright/test';
