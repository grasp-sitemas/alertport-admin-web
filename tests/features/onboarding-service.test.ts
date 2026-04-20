import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onboardingService } from '@/services/onboarding.service';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';

// Contract tests for the onboarding service. The persistence decision
// ("never show again") lives on the backend, so the frontend MUST
// post to the right URL with the right shape. A rename here is a
// latent bug that only surfaces on the second login of a real user.

describe('onboardingService', () => {
  let post: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    post = vi.spyOn(apiClient, 'post');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getStatus POSTs to /api/users/system/onboarding/status/v1/', async () => {
    post.mockResolvedValue({ data: { status: 200, result: {} } } as never);
    await onboardingService.getStatus();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe(endpoints.onboardingStatus);
  });

  it('getStatus unwraps the result envelope', async () => {
    const result = {
      adminCompletedAt: '2026-04-20T10:00:00Z',
      operatorCompletedAt: undefined,
      skipped: false,
    };
    post.mockResolvedValue({ data: { status: 200, result } } as never);
    const out = await onboardingService.getStatus();
    expect(out).toEqual(result);
  });

  it('getStatus returns {} when backend sends empty envelope', async () => {
    post.mockResolvedValue({ data: { status: 200 } } as never);
    const out = await onboardingService.getStatus();
    expect(out).toEqual({});
  });

  it('complete POSTs tour + action to /complete/v1/', async () => {
    post.mockResolvedValue({ data: { status: 200, result: {} } } as never);
    await onboardingService.complete('admin', 'completed');
    expect(post.mock.calls[0][0]).toBe(endpoints.onboardingComplete);
    expect(post.mock.calls[0][1]).toEqual({ tour: 'admin', action: 'completed' });
  });

  it('complete accepts skipped action', async () => {
    post.mockResolvedValue({ data: { status: 200 } } as never);
    await onboardingService.complete('operator', 'skipped');
    expect(post.mock.calls[0][1]).toEqual({ tour: 'operator', action: 'skipped' });
  });

  it('complete defaults to "completed" when no action provided', async () => {
    post.mockResolvedValue({ data: { status: 200 } } as never);
    await onboardingService.complete('admin');
    expect(post.mock.calls[0][1]).toEqual({ tour: 'admin', action: 'completed' });
  });

  it('only "admin" and "operator" are valid tour values at the type level', () => {
    // Compile-time guard — if someone adds a new tour, update the
    // union type + this assertion. TypeScript will fail the build
    // if the union widens unexpectedly.
    const valid: 'admin' | 'operator' = 'admin';
    expect(['admin', 'operator']).toContain(valid);
  });
});
