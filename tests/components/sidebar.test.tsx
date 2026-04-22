/**
 * Sidebar accordion behavior — guards the contract that the brief
 * locked in:
 *  - role+module filtering keeps working (delegated to existing hooks
 *    we mock, but we assert the rendered surface),
 *  - accordion is single-expand and toggles the way the user expects,
 *  - active route opens its owning section by default,
 *  - one-item sections render flat (no trigger),
 *  - manual toggles are persisted to localStorage under the agreed key.
 *
 * We use `vi.doMock` + dynamic import of the component (same pattern
 * trial-banner.test uses) so each test can wire the pathname / role it
 * needs before the module graph instantiates the hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import ptMessages from '@/messages/pt.json';
import type { UserSubtype } from '@/types/api';

// Reset mocks between tests so each renderWithRoute call gets a fresh
// module graph. Without this the first usePathname mock leaks into
// later renders.
afterEach(() => {
  cleanup();
  vi.resetModules();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

type RenderOpts = {
  pathname: string;
  role?: UserSubtype;
  /** Optional pre-existing localStorage value for the open-section key. */
  storedSection?: string;
};

async function renderSidebar({
  pathname,
  role = 'ADMIN',
  storedSection,
}: RenderOpts) {
  if (storedSection) {
    // Stored as a bare string (legacy shape) — the sidebar tolerates
    // both legacy bare strings and the new JSON {value, pathname}
    // payload, so we exercise the legacy path here.
    window.localStorage.setItem(
      'alertport-admin-sidebar-open-section',
      storedSection,
    );
  }

  vi.doMock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => pathname,
    useSearchParams: () => new URLSearchParams(),
  }));

  vi.doMock('@/hooks/use-auth', () => ({
    useAuth: () => ({
      user: {
        _id: 'u1',
        firstName: 'Test',
        lastName: 'User',
        email: 't@u',
      },
      token: 'x',
      isAuthenticated: true,
      login: () => {},
      logout: () => {},
      userSubtype: role,
      hasRole: () => true,
    }),
  }));

  // Default fail-open: every module enabled. Tests that need to flip
  // a module off can override before calling renderSidebar.
  vi.doMock('@/features/modules/use-session-account-modules', () => ({
    useSessionAccountModules: () => ({
      isEnabled: () => true,
      isSuperAdmin: false,
      isLoading: false,
    }),
  }));

  // Logo pulls in next/image and brand assets — none of that matters
  // for navigation behaviour, so stub it out.
  vi.doMock('@/components/layout/logo', () => ({
    Logo: () => <div data-testid="logo">Logo</div>,
  }));

  const { Sidebar } = await import('@/components/layout/sidebar');

  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages as Record<string, unknown>}>
      <Sidebar isOpen={true} onClose={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe('Sidebar — RBAC + structure', () => {
  it('renders sections allowed for an ADMIN role', async () => {
    await renderSidebar({ pathname: '/dashboard', role: 'ADMIN' });
    // Multi-item section headers (pt.json). Schedules has only one
    // ADMIN-visible item so it renders as a flat link labelled by
    // the item, not the section — see the flat-link test below.
    expect(screen.getByText('Monitoramento')).toBeInTheDocument();
    expect(screen.getByText('Timelines')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
    expect(screen.getByText('Gestão')).toBeInTheDocument();
    expect(screen.getByText('Empresa')).toBeInTheDocument();
    // The single-item Schedules section is reachable as a flat link.
    expect(
      screen.getByRole('link', { name: /Agendamento de Alertas/i }),
    ).toBeInTheDocument();
  });

  it('hides sections an AUDITOR role cannot reach', async () => {
    // AUDITOR has no items in Monitoring/Schedules/Reports/Management/
    // Company per navigation.ts, so those sections must collapse out
    // entirely (filteredNavigation drops empty sections).
    await renderSidebar({ pathname: '/dashboard', role: 'AUDITOR' });
    expect(screen.queryByText('Monitoramento')).not.toBeInTheDocument();
    expect(screen.queryByText('Agendamentos')).not.toBeInTheDocument();
    expect(screen.queryByText('Gestão')).not.toBeInTheDocument();
    expect(screen.queryByText('Empresa')).not.toBeInTheDocument();
    // But timelines (alertOccurrences + timeEntries are AUDITOR-allowed)
    // and the dashboard flat link must still be present.
    expect(screen.getByText('Timelines')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders single-item sections (Dashboard) as a flat link, no accordion trigger', async () => {
    await renderSidebar({ pathname: '/dashboard', role: 'ADMIN' });
    const dashboard = screen.getByRole('link', { name: /Dashboard/i });
    expect(dashboard).toHaveAttribute('href', '/dashboard');
    // A flat section must NOT spawn an accordion button — the only
    // accordion buttons are for multi-item sections.
    const triggers = screen.getAllByRole('button');
    for (const btn of triggers) {
      expect(btn).not.toHaveAccessibleName('Dashboard');
    }
  });
});

describe('Sidebar — initial-open behavior', () => {
  it('opens the section that owns the active route on mount', async () => {
    await renderSidebar({ pathname: '/alerts/monitor', role: 'ADMIN' });
    // The Monitoring trigger should be data-state=open and its content
    // should contain the active item link.
    const monitoringTrigger = screen.getByRole('button', { name: /Monitoramento/i });
    expect(monitoringTrigger).toHaveAttribute('data-state', 'open');
    expect(
      screen.getByRole('link', { name: /Monitor de Alertas/i }),
    ).toBeInTheDocument();
  });

  it('respects sub-route matching when picking the active section', async () => {
    // /alerts/monitor/123 should still open Monitoring.
    await renderSidebar({ pathname: '/alerts/monitor/abc-id', role: 'ADMIN' });
    const monitoringTrigger = screen.getByRole('button', { name: /Monitoramento/i });
    expect(monitoringTrigger).toHaveAttribute('data-state', 'open');
  });

  it('falls back to localStorage when no route matches a section', async () => {
    await renderSidebar({
      pathname: '/some-unknown-route',
      role: 'ADMIN',
      storedSection: 'sidebar.reports',
    });
    const reportsTrigger = screen.getByRole('button', { name: /Relatórios/i });
    expect(reportsTrigger).toHaveAttribute('data-state', 'open');
  });

  it('opens nothing when no route matches and nothing is stored', async () => {
    await renderSidebar({ pathname: '/some-unknown-route', role: 'ADMIN' });
    const triggers = screen.getAllByRole('button');
    for (const btn of triggers) {
      // Skip the mobile close button and any non-accordion button.
      if (btn.getAttribute('data-state')) {
        expect(btn.getAttribute('data-state')).toBe('closed');
      }
    }
  });
});

describe('Sidebar — single-expand toggling', () => {
  it('opens a section on click and closes the previously-open one', async () => {
    const user = userEvent.setup();
    await renderSidebar({ pathname: '/alerts/monitor', role: 'ADMIN' });

    const monitoring = screen.getByRole('button', { name: /Monitoramento/i });
    const reports = screen.getByRole('button', { name: /Relatórios/i });

    // Sanity: monitoring is open (active route).
    expect(monitoring).toHaveAttribute('data-state', 'open');
    expect(reports).toHaveAttribute('data-state', 'closed');

    // Open Reports — single-expand contract: monitoring must close.
    await user.click(reports);
    expect(reports).toHaveAttribute('data-state', 'open');
    expect(monitoring).toHaveAttribute('data-state', 'closed');
  });

  it('clicking the open trigger collapses everything', async () => {
    const user = userEvent.setup();
    await renderSidebar({ pathname: '/alerts/monitor', role: 'ADMIN' });

    const monitoring = screen.getByRole('button', { name: /Monitoramento/i });
    expect(monitoring).toHaveAttribute('data-state', 'open');
    await user.click(monitoring);
    expect(monitoring).toHaveAttribute('data-state', 'closed');
  });
});

describe('Sidebar — persistence', () => {
  it('writes the user-toggled section to localStorage (stamped with pathname)', async () => {
    const user = userEvent.setup();
    await renderSidebar({ pathname: '/dashboard', role: 'ADMIN' });

    const reports = screen.getByRole('button', { name: /Relatórios/i });
    await user.click(reports);

    const raw = window.localStorage.getItem(
      'alertport-admin-sidebar-open-section',
    );
    expect(raw).not.toBeNull();
    // Stored as JSON {value, pathname} so a later navigation can tell
    // apart "user opened this here" from "user opened it earlier".
    const parsed = JSON.parse(raw!);
    expect(parsed).toEqual({
      value: 'sidebar.reports',
      pathname: '/dashboard',
    });
  });

  it('records an explicit collapse so the active-route auto-open can be overridden', async () => {
    const user = userEvent.setup();
    // Land on /alerts/monitor so Monitoring is auto-opened. The user
    // closes it on purpose — that intent must outrank the auto-open
    // for the duration of this page (otherwise clicking the trigger
    // would do nothing visible, which feels broken).
    await renderSidebar({ pathname: '/alerts/monitor', role: 'ADMIN' });

    const monitoring = screen.getByRole('button', { name: /Monitoramento/i });
    expect(monitoring).toHaveAttribute('data-state', 'open');
    await user.click(monitoring);
    expect(monitoring).toHaveAttribute('data-state', 'closed');

    const raw = window.localStorage.getItem(
      'alertport-admin-sidebar-open-section',
    );
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    // Empty string is the explicit "user collapsed it here" marker.
    expect(parsed).toEqual({ value: '', pathname: '/alerts/monitor' });
  });
});
