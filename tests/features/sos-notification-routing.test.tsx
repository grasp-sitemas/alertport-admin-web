/**
 * Event-routing tests for the LIVE realtime owner: SosNotificationProvider.
 *
 * The monitor page reads its event list from the dedicated high-volume
 * endpoint, whose React Query key is `patrol-actions-monitor` (NOT the
 * generic `patrol-actions`). The provider owns the single Firestore
 * subscription for the whole app, so it is the only place that can keep
 * that cache fresh. These tests lock in the regressions reported by the
 * operator on 2026-06-03:
 *
 *   1. A new SOS must invalidate `patrol-actions-monitor` so the monitor
 *      list refetches and shows the alert WITHOUT a manual Shift+Ctrl+R.
 *      (Previously only `patrol-actions`/`occurrences` were invalidated,
 *      so the monitor list went stale.)
 *
 *   2. attendance:update / :close optimistic patch must reach the monitor
 *      cache too, so another operator's claim locks the card live.
 *
 * We stub `subscribeToAlertportRealtime` to capture the provider's
 * onEvent and fire synthetic events at it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AlertportRealtimeEvent } from '@/features/alerts/realtime';

let capturedOnEvent: ((evt: AlertportRealtimeEvent) => void) | null = null;

vi.mock('@/features/alerts/realtime', () => ({
  subscribeToAlertportRealtime: (opts: { onEvent: (evt: AlertportRealtimeEvent) => void }) => {
    capturedOnEvent = opts.onEvent;
    return () => {
      capturedOnEvent = null;
    };
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { _id: 'u1' } }),
}));

const SCOPE = {
  accountId: 'acc-1',
  clientId: 'cli-1',
  siteId: 'sit-1',
  siteGroupId: 'sg-1',
};

vi.mock('@/hooks/use-user-scope', () => ({
  useUserScope: () => SCOPE,
  applyUserScope: (params: Record<string, unknown>) => params,
}));

const filterPatrolActions = vi.fn(async () => ({ results: [], total: 0 }));

vi.mock('@/services/alerts.service', () => ({
  alertsService: {
    filterPatrolActions: () => filterPatrolActions(),
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    error: vi.fn(),
  },
}));

async function mountProvider() {
  const { SosNotificationProvider } = await import('@/features/alerts/sos-notification-context');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  render(
    <Wrapper>
      <SosNotificationProvider>
        <div>child</div>
      </SosNotificationProvider>
    </Wrapper>,
  );
  return { qc, fire: (evt: AlertportRealtimeEvent) => capturedOnEvent?.(evt) };
}

function invalidatedKeys(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((c: unknown[]) =>
    JSON.stringify((c[0] as { queryKey?: unknown }).queryKey),
  );
}

describe('SosNotificationProvider realtime routing', () => {
  beforeEach(() => {
    capturedOnEvent = null;
    filterPatrolActions.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('SOS_ALERT invalidates the dedicated monitor query key', async () => {
    const { qc, fire } = await mountProvider();
    await waitFor(() => expect(capturedOnEvent).toBeTypeOf('function'));
    const spy = vi.spyOn(qc, 'invalidateQueries');

    fire({ kind: 'notification', siteId: 'sit-1', data: { type: 'SOS_ALERT' } });

    const keys = invalidatedKeys(spy);
    expect(keys).toContain(JSON.stringify(['patrol-actions-monitor']));
  });

  it('attendance:update optimistic patch reaches the monitor cache', async () => {
    const { qc, fire } = await mountProvider();
    await waitFor(() => expect(capturedOnEvent).toBeTypeOf('function'));

    qc.setQueryData(['patrol-actions-monitor', { scope: 'mine' }], {
      results: [{ _id: 'e-target', attendance: { isAttendance: false } }],
    });

    fire({
      kind: 'attendance:update',
      siteGroupId: 'sg-1',
      data: {
        patrolActionId: 'e-target',
        attendance: JSON.stringify({ isAttendance: true, status: 'IN_PROGRESS' }),
      },
    });

    const patched = qc.getQueryData(['patrol-actions-monitor', { scope: 'mine' }]) as {
      results: { _id: string; attendance: Record<string, unknown> }[];
    };
    expect(patched.results[0].attendance).toMatchObject({
      isAttendance: true,
      status: 'IN_PROGRESS',
    });
  });
});
