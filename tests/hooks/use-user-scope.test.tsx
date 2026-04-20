/**
 * Tests for useUserScope.
 *
 * siteGroupId is the field that gates realtime attendance events — if
 * we stop extracting it correctly, the monitor stops seeing the
 * claim/close events firefighter-style, and two operators can race.
 * These tests lock the extraction against every shape the backend has
 * hydrated in the wild (string id, populated object, nested ref,
 * missing entirely).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

afterEach(() => {
  vi.resetModules();
});

function mockAuthUser(user: unknown) {
  vi.doMock('@/hooks/use-auth', () => ({
    useAuth: () => ({ user, token: 'x', isAuthenticated: !!user }),
  }));
}

async function runScope(user: unknown) {
  mockAuthUser(user);
  const { useUserScope } = await import('@/hooks/use-user-scope');
  return renderHook(() => useUserScope()).result.current;
}

describe('useUserScope', () => {
  it('extracts accountId, clientId, siteId from populated object refs', async () => {
    const scope = await runScope({
      account: { _id: 'acc-1' },
      client: { _id: 'cli-1' },
      site: { _id: 'sit-1' },
    });
    expect(scope.accountId).toBe('acc-1');
    expect(scope.clientId).toBe('cli-1');
    expect(scope.siteId).toBe('sit-1');
  });

  it('extracts scope from raw string ids (legacy shape)', async () => {
    const scope = await runScope({
      account: 'acc-1',
      client: 'cli-1',
      site: 'sit-1',
    });
    expect(scope.accountId).toBe('acc-1');
    expect(scope.clientId).toBe('cli-1');
    expect(scope.siteId).toBe('sit-1');
  });

  it('returns undefined for missing fields instead of empty string', async () => {
    const scope = await runScope({ account: { _id: 'acc-1' } });
    expect(scope.accountId).toBe('acc-1');
    expect(scope.clientId).toBeUndefined();
    expect(scope.siteId).toBeUndefined();
    expect(scope.siteGroupId).toBeUndefined();
  });

  it('extracts siteGroupId from a populated object', async () => {
    // This is the critical field for realtime attendance subscriptions.
    const scope = await runScope({
      account: { _id: 'acc-1' },
      siteGroup: { _id: 'sg-1' },
    });
    expect(scope.siteGroupId).toBe('sg-1');
  });

  it('extracts siteGroupId from a raw string (legacy JWT shape)', async () => {
    const scope = await runScope({
      account: { _id: 'acc-1' },
      siteGroup: 'sg-raw',
    });
    expect(scope.siteGroupId).toBe('sg-raw');
  });

  it('returns all-undefined when there is no user', async () => {
    const scope = await runScope(null);
    expect(scope.accountId).toBeUndefined();
    expect(scope.clientId).toBeUndefined();
    expect(scope.siteId).toBeUndefined();
    expect(scope.siteGroupId).toBeUndefined();
  });
});

describe('applyUserScope', () => {
  it('injects missing account/client/site from the scope', async () => {
    const { applyUserScope } = await import('@/hooks/use-user-scope');
    const out = applyUserScope(
      { skip: 1, limit: 20 },
      { accountId: 'acc-1', clientId: 'cli-1', siteId: 'sit-1' },
    );
    expect(out.account).toBe('acc-1');
    expect(out.client).toBe('cli-1');
    expect(out.site).toBe('sit-1');
  });

  it('does not overwrite explicit filter values (user UI wins over session)', async () => {
    const { applyUserScope } = await import('@/hooks/use-user-scope');
    const out = applyUserScope(
      { account: 'user-pick', client: '', site: undefined },
      { accountId: 'acc-session', clientId: 'cli-session', siteId: 'sit-session' },
    );
    expect(out.account).toBe('user-pick');
    // Empty string / undefined are still considered unset, so they
    // pick up the session fallback — matches the legacy shieldgo rule.
    expect(out.client).toBe('cli-session');
    expect(out.site).toBe('sit-session');
  });

  it('leaves keys out entirely when the scope is empty', async () => {
    const { applyUserScope } = await import('@/hooks/use-user-scope');
    const out = applyUserScope({ skip: 1, limit: 20 }, {});
    expect(out).not.toHaveProperty('account');
    expect(out).not.toHaveProperty('client');
    expect(out).not.toHaveProperty('site');
  });
});
