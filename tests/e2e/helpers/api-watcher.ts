/**
 * Light-weight API watcher.
 *
 * The HML backend is occasionally flaky (500s on edit-series, hangs
 * on delete). When a spec fails it's invaluable to know what the
 * frontend actually fired. Attach this helper, then `.dump()` in a
 * `test.afterEach` to print all matching requests.
 *
 * Usage:
 *   const watcher = attachApiWatcher(page, /api-hml\.shieldgo\.com\.br/);
 *   // ... run spec ...
 *   if (testInfo.status !== 'passed') console.log(watcher.dump());
 */
import type { Page, Request as PlaywrightRequest } from '@playwright/test';

export interface ApiCall {
  readonly method: string;
  readonly url: string;
  readonly status: number | null;
  readonly durationMs: number | null;
  readonly correlationId: string | null;
}

export interface ApiWatcher {
  readonly calls: ReadonlyArray<ApiCall>;
  dump(): string;
}

const CORRELATION_HEADER = 'x-correlation-id';

export function attachApiWatcher(page: Page, urlPattern: RegExp): ApiWatcher {
  const calls: ApiCall[] = [];
  const startTimes = new WeakMap<PlaywrightRequest, number>();

  page.on('request', (request) => {
    if (!urlPattern.test(request.url())) return;
    startTimes.set(request, Date.now());
  });

  page.on('response', async (response) => {
    const request = response.request();
    if (!urlPattern.test(request.url())) return;
    const startedAt = startTimes.get(request) ?? null;
    calls.push({
      method: request.method(),
      url: request.url(),
      status: response.status(),
      durationMs: startedAt ? Date.now() - startedAt : null,
      correlationId: request.headers()[CORRELATION_HEADER] ?? null,
    });
  });

  return {
    get calls(): ReadonlyArray<ApiCall> {
      return calls;
    },
    dump(): string {
      if (calls.length === 0) return '[api-watcher] no matching calls';
      return calls
        .map(
          (c) =>
            `[${c.method}] ${c.status ?? '???'} ${c.url} (${c.durationMs ?? '?'}ms) corr=${c.correlationId ?? '-'}`,
        )
        .join('\n');
    },
  };
}
