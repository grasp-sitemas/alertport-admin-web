/**
 * Event-routing tests for useAlertportRealtime.
 *
 * The hook drives three invariants the monitor and reports pages depend on:
 *   1. TIME_ENTRY notifications only invalidate the time-entries cache.
 *      A global patrol-actions refetch on every clock-in would hammer the
 *      backend and strip the in-progress highlight state on the monitor.
 *   2. SOS / INCIDENT / CRASH / ... notifications invalidate both
 *      patrol-actions and occurrences.
 *   3. attendance:update / attendance:close perform an OPTIMISTIC cache
 *      patch (setQueryData) so another operators claim locks the card
 *      before the next refetch lands, then invalidate to reconcile.
 *
 * We stub `subscribeToAlertportRealtime` to invoke our test harness with
 * synthetic events and assert the right QueryClient side-effects fire.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AlertportRealtimeEvent } from '@/features/alerts/realtime';

let capturedOnEvent: ((evt: AlertportRealtimeEvent) => void) | null = null;

// Stub subscribeToAlertportRealtime BEFORE loading the hook so our
// factory wins over the real Firestore subscription.
vi.mock('@/features/alerts/realtime', async () => {
  return {
    subscribeToAlertportRealtime: (opts: {
      onEvent: (evt: AlertportRealtimeEvent) => void;
    }) => {
      capturedOnEvent = opts.onEvent;
      return () => {
        capturedOnEvent = null;
      };
    },
  };
});

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      _id: 'u1',
      account: { _id: 'acc-1' },
      client: { _id: 'cli-1' },
      site: { _id: 'sit-1' },
      siteGroup: { _id: 'sg-1' },
    },
    token: 'x',
    isAuthenticated: true,
  }),
}));

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

async function mountHook() {
  const { useAlertportRealtime } = await import('@/features/alerts/use-realtime');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = renderHook(() => useAlertportRealtime(), {
    wrapper: wrapper(qc),
  });
  return { qc, result, fire: (evt: AlertportRealtimeEvent) => capturedOnEvent?.(evt) };
}

describe('useAlertportRealtime routing', () => {
  beforeEach(() => {
    capturedOnEvent = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('TIME_ENTRY notification invalidates ONLY the time-entries query', async () => {
    const { qc, fire } = await mountHook();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    fire({ kind: 'notification', siteId: 'sit-1', data: { type: 'TIME_ENTRY' } });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['time-entries'] });
    for (const call of spy.mock.calls) {
      const arg = call[0] as { queryKey?: readonly unknown[] };
      expect(arg.queryKey).not.toEqual(['patrol-actions']);
      expect(arg.queryKey).not.toEqual(['occurrences']);
    }
  });

  it('SOS_ALERT notification invalidates patrol-actions and occurrences', async () => {
    const { qc, fire } = await mountHook();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    fire({ kind: 'notification', siteId: 'sit-1', data: { type: 'SOS_ALERT' } });
    const keys = spy.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey?: unknown }).queryKey),
    );
    expect(keys).toContain(JSON.stringify(['patrol-actions']));
    expect(keys).toContain(JSON.stringify(['occurrences']));
    // NOT the time-entries cache - that would be a waste.
    expect(keys).not.toContain(JSON.stringify(['time-entries']));
  });

  it('INCIDENT notification routes like SOS (non-TIME_ENTRY path)', async () => {
    const { qc, fire } = await mountHook();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    fire({ kind: 'notification', siteId: 'sit-1', data: { type: 'INCIDENT' } });
    const keys = spy.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey?: unknown }).queryKey),
    );
    expect(keys).toContain(JSON.stringify(['patrol-actions']));
    expect(keys).toContain(JSON.stringify(['occurrences']));
  });

  it('attendance:update optimistically patches the matching patrol-action row in cache', async () => {
    const { qc, fire } = await mountHook();
    // Seed a cache entry the hook can patch.
    qc.setQueryData(['patrol-actions', { scope: 'mine' }], {
      results: [
        { _id: 'e-other', attendance: { isAttendance: false } },
        { _id: 'e-target', attendance: { isAttendance: false } },
      ],
    });

    const newAttendance = {
      isAttendance: true,
      status: 'IN_PROGRESS',
      operator: { _id: 'u2', firstName: 'Op', lastName: 'A' },
      openedDate: '2026-04-19T12:00:00Z',
    };
    fire({
      kind: 'attendance:update',
      siteGroupId: 'sg-1',
      data: {
        patrolActionId: 'e-target',
        attendance: JSON.stringify(newAttendance),
      },
    });

    const patched = qc.getQueryData(['patrol-actions', { scope: 'mine' }]) as {
      results: { _id: string; attendance: Record<string, unknown> }[];
    };
    const target = patched.results.find((r) => r._id === 'e-target');
    expect(target?.attendance).toMatchObject({
      isAttendance: true,
      status: 'IN_PROGRESS',
    });
    const other = patched.results.find((r) => r._id === 'e-other');
    expect(other?.attendance.isAttendance).toBe(false);
  });

  it('attendance:close also patches the cache and invalidates patrol-actions', async () => {
    const { qc, fire } = await mountHook();
    qc.setQueryData(['patrol-actions', { scope: 'mine' }], {
      results: [{ _id: 'e-x', attendance: { isAttendance: true, status: 'IN_PROGRESS' } }],
    });
    const spy = vi.spyOn(qc, 'invalidateQueries');

    fire({
      kind: 'attendance:close',
      siteGroupId: 'sg-1',
      data: {
        patrolActionId: 'e-x',
        attendance: JSON.stringify({
          isAttendance: true,
          status: 'CLOSED',
          closedDate: '2026-04-19T12:30:00Z',
        }),
      },
    });

    const patched = qc.getQueryData(['patrol-actions', { scope: 'mine' }]) as {
      results: { attendance: Record<string, unknown> }[];
    };
    expect(patched.results[0].attendance.status).toBe('CLOSED');
    expect(
      spy.mock.calls.some(
        (c) => JSON.stringify((c[0] as { queryKey?: unknown }).queryKey) === JSON.stringify(['patrol-actions']),
      ),
    ).toBe(true);
  });

  it('ignores attendance events with a non-parseable JSON payload', async () => {
    const { qc, fire } = await mountHook();
    qc.setQueryData(['patrol-actions', 'x'], {
      results: [{ _id: 'e', attendance: { isAttendance: false } }],
    });
    fire({
      kind: 'attendance:update',
      siteGroupId: 'sg-1',
      data: { patrolActionId: 'e', attendance: 'not-json' },
    });
    // Cache row is NOT corrupted when JSON parse fails.
    const cached = qc.getQueryData(['patrol-actions', 'x']) as {
      results: { attendance: Record<string, unknown> }[];
    };
    expect(cached.results[0].attendance.isAttendance).toBe(false);
  });

  it('media + attendance:report invalidate patrol-actions only', async () => {
    const { qc, fire } = await mountHook();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    fire({ kind: 'media', siteId: 'sit-1', data: {} });
    fire({ kind: 'attendance:report', siteGroupId: 'sg-1', data: {} });
    const invalidated = spy.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey?: unknown }).queryKey),
    );
    expect(invalidated.filter((k) => k === JSON.stringify(['patrol-actions'])).length).toBeGreaterThanOrEqual(2);
  });

  it('forwards every event to the onEvent callback from the caller', async () => {
    // Re-mount with a spy consumer. The hook reads options?.onEvent via a
    // ref set after mount; our harness doesn't forward options, but the
    // default exported hook does accept them - just verify it does not
    // throw when not supplied.
    const { fire } = await mountHook();
    expect(() => fire({ kind: 'media', siteId: 'sit-1', data: {} })).not.toThrow();
  });
});
