/**
 * Resolution rules for the SOS banner deep-link → AttendanceDialog target.
 *
 * Locks in the regression reported 2026-06-03: clicking "Atender" closed
 * the banner but never opened the attendance dialog. Root cause was the
 * monitor page giving up when the just-fired SOS row was not yet in the
 * loaded list. `resolveDeepLinkTarget` is the pure core the page polls
 * against; the page re-runs it as the list refetches through the backend
 * consistency window.
 */

import { describe, it, expect } from 'vitest';
import { resolveDeepLinkTarget } from '@/features/alerts/monitor-deep-link';
import type { PatrolAction } from '@/types/api';

function sos(overrides: Partial<PatrolAction>): PatrolAction {
  return {
    _id: 'unset',
    type: 'SOS_ALERT',
    status: 'ACTIVE',
    ...overrides,
  } as PatrolAction;
}

describe('resolveDeepLinkTarget', () => {
  it('resolves the exact row when the correlated id is present in the list', () => {
    const events = [sos({ _id: 'a' }), sos({ _id: 'b' })];
    expect(resolveDeepLinkTarget(events, 'b', true, 'u1')?._id).toBe('b');
  });

  it('falls back to the newest AVAILABLE SOS when the id is not yet in the list', () => {
    // Correlated id "z" hasn't landed in the monitor list yet; autoClaim
    // must still surface an actionable SOS rather than dead-end.
    const events = [sos({ _id: 'fresh' })];
    expect(resolveDeepLinkTarget(events, 'z', true, 'u1')?._id).toBe('fresh');
  });

  it('uses the AVAILABLE fallback when there is no correlated id at all', () => {
    const events = [
      sos({
        _id: 'claimed',
        attendance: { isAttendance: true, status: 'IN_PROGRESS' },
      }),
      sos({ _id: 'open' }),
    ];
    expect(resolveDeepLinkTarget(events, null, true, 'u1')?._id).toBe('open');
  });

  it('returns null when autoClaim is set but no SOS is available', () => {
    const events = [
      sos({ _id: 'closed', attendance: { isAttendance: true, status: 'CLOSED' } }),
    ];
    expect(resolveDeepLinkTarget(events, null, true, 'u1')).toBeNull();
  });

  it('returns null when neither an id nor autoClaim is provided', () => {
    const events = [sos({ _id: 'a' })];
    expect(resolveDeepLinkTarget(events, null, false, 'u1')).toBeNull();
  });

  it('returns null when the list is empty (row not queryable yet)', () => {
    expect(resolveDeepLinkTarget([], 'a', true, 'u1')).toBeNull();
  });
});
