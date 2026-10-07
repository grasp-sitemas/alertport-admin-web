import { describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({ withSentryConfig: (config: unknown) => config }));

describe('delivered security headers', () => {
  it('permits the CEP provider used by address forms', async () => {
    const { default: config } = await import('../../next.config');
    const routes = await config.headers!();
    const policy = routes[0].headers.find(header => header.key === 'Content-Security-Policy')?.value;
    const connectSources = policy?.split(';').map(part => part.trim()).find(part => part.startsWith('connect-src '))?.split(/\s+/).slice(1);
    expect(connectSources).toContain('https://viacep.com.br');
    expect(connectSources).not.toContain('*');
  });
});
