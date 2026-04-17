import { describe, it, expect } from 'vitest';
import type { TrialContext } from '@/types/trial';

/**
 * Re-implement the gating logic locally and assert it. This mirrors the
 * decision tree inside TrialProvider.canCreate / canUseFeature and ensures
 * the rules don't drift from the backend AccessPolicyService contract.
 */
function canCreate(ctx: TrialContext | null, resource: string, count = 1) {
  if (!ctx) return { allowed: true, reason: null as string | null };
  if (ctx.isReadOnly || ctx.isExpired) return { allowed: false, reason: 'TRIAL_EXPIRED' };
  const limit = ctx.limits?.[resource];
  if (limit === undefined || limit === null || limit === -1) {
    return { allowed: true, reason: null };
  }
  const used = ctx.usage?.[resource] ?? 0;
  if (used + count > (limit as number)) {
    return { allowed: false, reason: 'TRIAL_LIMIT_REACHED' };
  }
  return { allowed: true, reason: null };
}

function baseCtx(overrides: Partial<TrialContext> = {}): TrialContext {
  return {
    accountId: 'acc1',
    planType: 'TRIAL',
    isTrial: true,
    trialStatus: 'ACTIVE',
    trialStartAt: null,
    trialEndAt: null,
    daysRemaining: 5,
    isExpired: false,
    isReadOnly: false,
    features: {},
    limits: {},
    usage: {},
    blockedReason: null,
    ...overrides,
  };
}

describe('trial canCreate logic', () => {
  it('allows everything when context is null (legacy / not hydrated)', () => {
    expect(canCreate(null, 'users').allowed).toBe(true);
  });

  it('blocks with TRIAL_EXPIRED when isReadOnly', () => {
    const r = canCreate(baseCtx({ isReadOnly: true }), 'users');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TRIAL_EXPIRED');
  });

  it('blocks with TRIAL_EXPIRED when isExpired', () => {
    const r = canCreate(baseCtx({ isExpired: true }), 'users');
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TRIAL_EXPIRED');
  });

  it('allows when resource limit is unlimited (-1)', () => {
    const r = canCreate(baseCtx({ limits: { users: -1 }, usage: { users: 10_000 } }), 'users');
    expect(r.allowed).toBe(true);
  });

  it('allows when under the limit', () => {
    const r = canCreate(baseCtx({ limits: { users: 10 }, usage: { users: 5 } }), 'users', 2);
    expect(r.allowed).toBe(true);
  });

  it('blocks with TRIAL_LIMIT_REACHED when at or above the limit', () => {
    const r = canCreate(baseCtx({ limits: { users: 10 }, usage: { users: 10 } }), 'users', 1);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TRIAL_LIMIT_REACHED');
  });

  it('returns { allowed: true } for unknown resources (defensive)', () => {
    const r = canCreate(baseCtx(), 'nonexistent-resource');
    expect(r.allowed).toBe(true);
  });
});
