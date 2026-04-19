import { describe, it, expect } from 'vitest';
import { correlateSos } from '@/features/alerts/sos-correlation';
import type { PatrolAction } from '@/types/api';

// These tests lock in the rules used to deep-link a global SOS banner
// to the right row in the monitor. A wrong correlation either (a) sends
// the operator to a stale closed event and hides the real emergency,
// or (b) picks somebody else's in-progress event and shows them the
// locked-out state instead of the one they need to handle. Both are
// product-critical regressions.

function mkSos(overrides: Partial<PatrolAction>): PatrolAction {
  return {
    _id: 'unset',
    type: 'SOS_ALERT',
    status: 'ACTIVE',
    ...overrides,
  } as PatrolAction;
}

describe('correlateSos', () => {
  it('returns null when there are no candidates', () => {
    expect(
      correlateSos({
        candidates: [],
        notificationType: 'SOS_ALERT',
        notificationDate: new Date(),
      }),
    ).toBeNull();
  });

  it('returns null when no candidate matches the type', () => {
    expect(
      correlateSos({
        candidates: [
          mkSos({ _id: 'a', type: 'INCIDENT', date: new Date().toISOString() }),
        ],
        notificationType: 'SOS_ALERT',
        notificationDate: new Date(),
      }),
    ).toBeNull();
  });

  it('picks the row with the smallest |createdDate - notificationDate| within the window', () => {
    const notifAt = new Date('2026-04-19T12:00:00Z');
    const result = correlateSos({
      candidates: [
        mkSos({ _id: 'far', date: '2026-04-19T11:59:00Z' }),
        mkSos({ _id: 'near', date: '2026-04-19T12:00:01Z' }),
        mkSos({ _id: 'alsofar', date: '2026-04-19T12:00:30Z' }),
      ],
      notificationType: 'SOS_ALERT',
      notificationDate: notifAt,
    });
    expect(result?._id).toBe('near');
  });

  it('prefers an unclaimed row over a claimed one even if claimed is closer in time', () => {
    // Scenario: the same site had an SOS 5s ago that's already in-progress
    // (maybe manually opened before the notification landed due to a
    // realtime delay). A second SOS just fired. We must point the
    // operator at the new, actionable one — not the claimed one.
    const notifAt = new Date('2026-04-19T12:00:00Z');
    const result = correlateSos({
      candidates: [
        mkSos({
          _id: 'claimed',
          date: '2026-04-19T11:59:58Z',
          attendance: { isAttendance: true, status: 'IN_PROGRESS' },
        }),
        mkSos({ _id: 'fresh', date: '2026-04-19T12:00:05Z' }),
      ],
      notificationType: 'SOS_ALERT',
      notificationDate: notifAt,
    });
    expect(result?._id).toBe('fresh');
  });

  it('falls back to the closest row when everything in the window is claimed', () => {
    const notifAt = new Date('2026-04-19T12:00:00Z');
    const result = correlateSos({
      candidates: [
        mkSos({
          _id: 'far',
          date: '2026-04-19T11:59:45Z',
          attendance: { isAttendance: true, status: 'CLOSED' },
        }),
        mkSos({
          _id: 'near',
          date: '2026-04-19T12:00:05Z',
          attendance: { isAttendance: true, status: 'IN_PROGRESS' },
        }),
      ],
      notificationType: 'SOS_ALERT',
      notificationDate: notifAt,
    });
    expect(result?._id).toBe('near');
  });

  it('returns the closest single candidate even when outside the 60s window', () => {
    // Degraded fallback: if Mongo is lagging and the only SOS row we can
    // see is 5 minutes old, still return it (operator can dismiss if
    // wrong). Returning null here would leave the banner un-actionable.
    const notifAt = new Date('2026-04-19T12:00:00Z');
    const result = correlateSos({
      candidates: [
        mkSos({ _id: 'old', date: '2026-04-19T11:55:00Z' }),
      ],
      notificationType: 'SOS_ALERT',
      notificationDate: notifAt,
    });
    expect(result?._id).toBe('old');
  });

  it('accepts notificationDate as a string', () => {
    const result = correlateSos({
      candidates: [
        mkSos({ _id: 'hit', date: '2026-04-19T12:00:00Z' }),
      ],
      notificationType: 'SOS_ALERT',
      notificationDate: '2026-04-19T12:00:02Z',
    });
    expect(result?._id).toBe('hit');
  });

  it('returns null when notificationType is not found, even if candidates exist', () => {
    expect(
      correlateSos({
        candidates: [mkSos({ _id: 'a', type: 'CRASH' })],
        notificationType: 'SOS_ALERT',
        notificationDate: new Date(),
      }),
    ).toBeNull();
  });

  it('ignores rows with missing dates (infinite delta)', () => {
    const notifAt = new Date('2026-04-19T12:00:00Z');
    const result = correlateSos({
      candidates: [
        mkSos({ _id: 'nodate' }),
        mkSos({ _id: 'dated', date: '2026-04-19T12:00:01Z' }),
      ],
      notificationType: 'SOS_ALERT',
      notificationDate: notifAt,
    });
    expect(result?._id).toBe('dated');
  });
});
