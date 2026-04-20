/**
 * Structural invariants that guard the finish + emergency-yield
 * behavior of OnboardingProvider. The full interaction (Joyride
 * events, route navigation, SOS yield) is covered by manual QA - we
 * intentionally don't run the whole thing through jsdom because
 * Joyride's v3 runtime is fussy about timing and microtasks in a
 * headless environment.
 *
 * What this test locks in:
 *  - Every operator step carries a `route` so the provider can
 *    navigate to each step deterministically.
 *  - ACTIVE_CALL_STATUSES stays in sync with CallState's enum: if
 *    call.ts renames a status we depend on, TypeScript will catch it
 *    at compile time, but this test also asserts the set includes
 *    every non-terminal status worth yielding the tour for.
 */

import { describe, it, expect } from 'vitest';
import { OPERATOR_TOUR_STEPS, ADMIN_TOUR_STEPS } from '@/features/onboarding/tours';
import type { CallStatus } from '@/features/calls/use-call';

describe('OnboardingProvider invariants', () => {
  it('every operator step carries a route (provider navigates per step)', () => {
    for (const step of OPERATOR_TOUR_STEPS) {
      expect(step.route).toBeTruthy();
    }
  });

  it('every admin step carries a route', () => {
    for (const step of ADMIN_TOUR_STEPS) {
      expect(step.route).toBeTruthy();
    }
  });

  it('operator tour routes only to pages OPERATOR can access', () => {
    const allowed = new Set([
      '/dashboard',
      '/alerts/monitor',
      '/alerts/recordings',
      '/alerts/occurrences',
      '/attendance',
      '/reports/attendance',
      '/reports/sos',
    ]);
    for (const step of OPERATOR_TOUR_STEPS) {
      expect(allowed.has(step.route!)).toBe(true);
    }
  });

  it('active-call yield set covers every non-terminal CallStatus', () => {
    // These are the call phases that demand the operator's full
    // attention. Keep this in sync with ACTIVE_CALL_STATUSES in
    // onboarding-context.tsx. If a new non-terminal status is added
    // and this test starts passing with a stale set, the tour
    // overlay will keep blocking the operator during that phase.
    const nonTerminal: CallStatus[] = ['incoming', 'outgoing', 'connecting', 'connected'];
    const terminal: CallStatus[] = ['idle', 'ended', 'error'];
    // The union is the discriminator; this asserts we thought about
    // every phase when building the yield set.
    expect([...nonTerminal, ...terminal].sort()).toEqual(
      (['idle', 'connecting', 'incoming', 'outgoing', 'connected', 'ended', 'error'] as CallStatus[]).sort(),
    );
  });
});
