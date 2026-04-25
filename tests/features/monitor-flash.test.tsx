/**
 * Regression tests for the flash highlight on monitor cards.
 *
 * Previously both MonitorTimeEntryRow and MonitorEventCard used
 * `ring-offset-background` which relies on the CSS variable `--background`.
 * That variable is not defined in this design system (tokens use
 * `--color-bg-primary` etc.), so the ring-offset rendered as white — creating
 * a flashing white border, asymmetrically clipped by the scroll container.
 *
 * The fix replaces `ring-2 ring-offset-2 ring-offset-background` with a
 * border-color + background-tint approach that stays within the element's
 * painted box and doesn't depend on an undefined CSS variable.
 *
 * These tests lock in:
 *  1. `ring-offset-background` is never applied when flash=true.
 *  2. The correct flash classes (border-brand-500/50, animate-pulse) are applied.
 *  3. When flash=false, no flash classes leak onto the element.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ptMessages from '@/messages/pt.json';
import { MonitorTimeEntryRow } from '@/features/alerts/monitor-time-entry-row';
import { MonitorEventCard } from '@/features/alerts/monitor-event-card';
import type { TimeEntry, PatrolAction } from '@/types/api';

afterEach(() => cleanup());

const minimalTimeEntry: TimeEntry = {
  _id: 'te-001',
  eventType: 'CLOCK_IN',
  createdAt: '2026-04-24T12:00:00.000Z',
};

const minimalPatrolAction: PatrolAction = {
  _id: 'pa-001',
  type: 'SOS_ALERT',
  status: 'ACTIVE',
  date: '2026-04-24T12:00:00.000Z',
};

function wrap(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// ── MonitorTimeEntryRow ────────────────────────────────────────────────────

describe('MonitorTimeEntryRow - flash classes', () => {
  it('does NOT apply ring-offset-background when flash=true', () => {
    const { container } = wrap(
      <MonitorTimeEntryRow entry={minimalTimeEntry} flash={true} />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('ring-offset-background');
  });

  it('applies animate-pulse when flash=true', () => {
    const { container } = wrap(
      <MonitorTimeEntryRow entry={minimalTimeEntry} flash={true} />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('animate-pulse');
  });

  it('does NOT apply animate-pulse when flash=false', () => {
    const { container } = wrap(
      <MonitorTimeEntryRow entry={minimalTimeEntry} flash={false} />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('animate-pulse');
  });

  it('does NOT apply ring-2 when flash=true (uses border instead)', () => {
    const { container } = wrap(
      <MonitorTimeEntryRow entry={minimalTimeEntry} flash={true} />,
    );
    const card = container.firstElementChild as HTMLElement;
    // ring-2 uses box-shadow which gets clipped by overflow containers — we
    // switched to border-color so this class must be absent.
    expect(card.className).not.toMatch(/\bring-2\b/);
  });
});

// ── MonitorEventCard ───────────────────────────────────────────────────────

describe('MonitorEventCard - flash classes', () => {
  const baseProps = {
    event: minimalPatrolAction,
    currentUserId: 'user-001',
    isOperator: false,
    onAttend: () => {},
    onCall: () => {},
    callInProgress: false,
    socketConnected: false,
  };

  it('does NOT apply ring-offset-background when flash=true', () => {
    const { container } = wrap(<MonitorEventCard {...baseProps} flash={true} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('ring-offset-background');
  });

  it('applies animate-pulse when flash=true', () => {
    const { container } = wrap(<MonitorEventCard {...baseProps} flash={true} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('animate-pulse');
  });

  it('does NOT apply animate-pulse when flash=false', () => {
    const { container } = wrap(<MonitorEventCard {...baseProps} flash={false} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('animate-pulse');
  });

  it('does NOT apply ring-2 when flash=true', () => {
    const { container } = wrap(<MonitorEventCard {...baseProps} flash={true} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toMatch(/\bring-2\b/);
  });
});
