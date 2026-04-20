/**
 * TrialBanner role-gate tests.
 *
 * The banner itself is still shown to every role during a trial (so
 * OPERATORs know the window is closing), but the "Ver plano" / upgrade
 * CTA is only visible to the roles that can actually act on billing:
 * SUPER_ADMIN_MASTER / ADMIN_MASTER / ADMIN. Guards those rules.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ptMessages from '@/messages/pt.json';
import type { User, UserSubtype } from '@/types/api';

afterEach(() => {
  cleanup();
  vi.resetModules();
});

type TrialState = {
  isTrial: boolean;
  isReadOnly: boolean;
  daysRemaining: number | null;
};

function mockHooks(trial: TrialState, role: UserSubtype | null) {
  vi.doMock('@/hooks/use-trial', () => ({
    useTrial: () => ({
      ...trial,
      context: null,
      isLoading: false,
      isReady: true,
      plans: [],
      refresh: async () => {},
      canCreate: () => ({ allowed: true, reason: null }),
      canUseFeature: () => ({ allowed: true, reason: null }),
    }),
  }));
  vi.doMock('@/hooks/use-auth', () => ({
    useAuth: () => ({
      user: role
        ? ({
            _id: 'u1',
            firstName: 'Test',
            lastName: 'User',
            email: 't@u',
            status: 'ACTIVE',
            type: 'USER-COMPANY',
            companyUser: { subtype: role, status: 'ACTIVE' },
          } as User)
        : null,
      token: 'x',
      isAuthenticated: !!role,
      login: () => {},
      logout: () => {},
      userSubtype: role ?? undefined,
      hasRole: () => true,
    }),
  }));
}

async function renderWithState(trial: TrialState, role: UserSubtype | null) {
  mockHooks(trial, role);
  // Dynamic import AFTER the mocks are wired so the component picks up
  // our fakes instead of the real hooks.
  const { TrialBanner: Banner } = await import('@/components/trial/trial-banner');
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages as Record<string, unknown>}>
      <Banner />
    </NextIntlClientProvider>,
  );
}

describe('TrialBanner — render gating', () => {
  it('renders nothing when not on a trial', async () => {
    await renderWithState({ isTrial: false, isReadOnly: false, daysRemaining: null }, 'ADMIN');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an informational banner with 10 days remaining', async () => {
    await renderWithState({ isTrial: true, isReadOnly: false, daysRemaining: 10 }, 'ADMIN');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the expired variant with role="alert"', async () => {
    await renderWithState({ isTrial: true, isReadOnly: true, daysRemaining: 0 }, 'ADMIN');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('TrialBanner — "Ver plano" CTA role gate', () => {
  const activeTrial: TrialState = { isTrial: true, isReadOnly: false, daysRemaining: 10 };
  const expiredTrial: TrialState = { isTrial: true, isReadOnly: true, daysRemaining: 0 };

  it('shows the CTA for ADMIN', async () => {
    await renderWithState(activeTrial, 'ADMIN');
    expect(screen.getByRole('link', { name: /Ver plano/i })).toBeInTheDocument();
  });

  it('shows the CTA for ADMIN_MASTER', async () => {
    await renderWithState(activeTrial, 'ADMIN_MASTER');
    expect(screen.getByRole('link', { name: /Ver plano/i })).toBeInTheDocument();
  });

  it('shows the CTA for SUPER_ADMIN_MASTER', async () => {
    await renderWithState(activeTrial, 'SUPER_ADMIN_MASTER');
    expect(screen.getByRole('link', { name: /Ver plano/i })).toBeInTheDocument();
  });

  it('HIDES the CTA for OPERATOR (the core product rule)', async () => {
    await renderWithState(activeTrial, 'OPERATOR');
    // Banner still shows so the operator sees the countdown, but without
    // an action they can't actually take.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ver plano/i })).not.toBeInTheDocument();
  });

  it('HIDES the CTA for AUDITOR', async () => {
    await renderWithState(activeTrial, 'AUDITOR');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ver plano/i })).not.toBeInTheDocument();
  });

  it('HIDES the CTA for MANAGER (not an admin of the company)', async () => {
    await renderWithState(activeTrial, 'MANAGER');
    expect(screen.queryByRole('link', { name: /Ver plano/i })).not.toBeInTheDocument();
  });

  it('HIDES the CTA when there is no user (pre-auth state)', async () => {
    await renderWithState(activeTrial, null);
    expect(screen.queryByRole('link', { name: /Ver plano/i })).not.toBeInTheDocument();
  });

  it('expired-trial upgrade CTA is gated the same way for OPERATOR', async () => {
    await renderWithState(expiredTrial, 'OPERATOR');
    // The expired banner still renders (role=alert), but without the
    // upgrade link since the operator can't act on it.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('expired-trial upgrade CTA IS shown for ADMIN', async () => {
    await renderWithState(expiredTrial, 'ADMIN');
    expect(screen.getByRole('link')).toBeInTheDocument();
  });
});
