import { describe, it, expect } from 'vitest';
import {
  classifyAttendance,
  extractAttendanceOwner,
} from '@/features/alerts/attendance-state';
import type { PatrolAction } from '@/types/api';

// The classifier is the single source of truth for the attendance
// lifecycle - every surface (event card, dialog, KPIs, realtime) reads
// from it. Coverage here is intentionally exhaustive because a wrong
// classification is either "operator can't do their job" or - worse -
// "two operators claim the same event" (the backend's attendance DAO
// uses a blind $set and cannot detect the race itself).

const USER_A = 'user-a';
const USER_B = 'user-b';

function mkEvent(attendance?: PatrolAction['attendance']): PatrolAction {
  return {
    _id: 'evt-1',
    type: 'SOS_ALERT',
    status: 'ACTIVE',
    attendance,
  } as PatrolAction;
}

describe('classifyAttendance', () => {
  describe('AVAILABLE state', () => {
    it('returns AVAILABLE when attendance object is missing', () => {
      expect(classifyAttendance(mkEvent(undefined), USER_A)).toBe('AVAILABLE');
    });

    it('returns AVAILABLE when attendance is null', () => {
      // Some legacy backends hydrate the field as null rather than omit.
      const event = { ...mkEvent(), attendance: null } as unknown as PatrolAction;
      expect(classifyAttendance(event, USER_A)).toBe('AVAILABLE');
    });

    it('returns AVAILABLE when isAttendance is false', () => {
      expect(
        classifyAttendance(
          mkEvent({ isAttendance: false, status: 'IN_PROGRESS' }),
          USER_A,
        ),
      ).toBe('AVAILABLE');
    });

    it('returns AVAILABLE when isAttendance is undefined even if status exists', () => {
      expect(
        classifyAttendance(mkEvent({ status: 'IN_PROGRESS' }), USER_A),
      ).toBe('AVAILABLE');
    });

    it('returns AVAILABLE for unknown status values', () => {
      expect(
        classifyAttendance(
          mkEvent({
            isAttendance: true,
            // Legacy aliases that never made it into the contract
            status: 'COMPLETED' as unknown as 'IN_PROGRESS',
          }),
          USER_A,
        ),
      ).toBe('AVAILABLE');
    });

    it('returns AVAILABLE when the event itself is null or undefined', () => {
      expect(classifyAttendance(null, USER_A)).toBe('AVAILABLE');
      expect(classifyAttendance(undefined, USER_A)).toBe('AVAILABLE');
    });
  });

  describe('IN_PROGRESS_BY_ME state', () => {
    it('returns IN_PROGRESS_BY_ME when owned by current user (populated operator)', () => {
      expect(
        classifyAttendance(
          mkEvent({
            isAttendance: true,
            status: 'IN_PROGRESS',
            operator: { _id: USER_A } as unknown as string,
          }),
          USER_A,
        ),
      ).toBe('IN_PROGRESS_BY_ME');
    });

    it('returns IN_PROGRESS_BY_ME when operator is a raw string id equal to currentUserId', () => {
      expect(
        classifyAttendance(
          mkEvent({
            isAttendance: true,
            status: 'IN_PROGRESS',
            operator: USER_A,
          }),
          USER_A,
        ),
      ).toBe('IN_PROGRESS_BY_ME');
    });
  });

  describe('IN_PROGRESS_BY_OTHER state', () => {
    it('returns IN_PROGRESS_BY_OTHER when operator differs', () => {
      expect(
        classifyAttendance(
          mkEvent({
            isAttendance: true,
            status: 'IN_PROGRESS',
            operator: { _id: USER_B } as unknown as string,
          }),
          USER_A,
        ),
      ).toBe('IN_PROGRESS_BY_OTHER');
    });

    it('returns IN_PROGRESS_BY_OTHER when operator id is missing (cannot prove ownership)', () => {
      // Conservative default: if we can't verify ownership, lock it - better
      // a false negative on "it's mine" than the takeover bug.
      expect(
        classifyAttendance(
          mkEvent({
            isAttendance: true,
            status: 'IN_PROGRESS',
          }),
          USER_A,
        ),
      ).toBe('IN_PROGRESS_BY_OTHER');
    });

    it('returns IN_PROGRESS_BY_OTHER when current user is anonymous', () => {
      expect(
        classifyAttendance(
          mkEvent({
            isAttendance: true,
            status: 'IN_PROGRESS',
            operator: { _id: USER_A } as unknown as string,
          }),
          undefined,
        ),
      ).toBe('IN_PROGRESS_BY_OTHER');
    });
  });

  describe('CLOSED state', () => {
    it('returns CLOSED regardless of owner', () => {
      // Crucial: after closing, isAttendance stays true AND status=CLOSED.
      // The naive `isAttendance ? IN_PROGRESS : AVAILABLE` logic we had
      // before would wrongly paint every closed event as still in progress.
      expect(
        classifyAttendance(
          mkEvent({
            isAttendance: true,
            status: 'CLOSED',
            operator: { _id: USER_A } as unknown as string,
          }),
          USER_A,
        ),
      ).toBe('CLOSED');

      expect(
        classifyAttendance(
          mkEvent({
            isAttendance: true,
            status: 'CLOSED',
            operator: { _id: USER_B } as unknown as string,
          }),
          USER_A,
        ),
      ).toBe('CLOSED');
    });
  });
});

describe('extractAttendanceOwner', () => {
  it('returns empty object when attendance is missing', () => {
    expect(extractAttendanceOwner(undefined)).toEqual({});
  });

  it('returns empty object when operator is missing', () => {
    expect(extractAttendanceOwner({ isAttendance: true })).toEqual({});
  });

  it('returns just the userId when operator is a raw string', () => {
    expect(
      extractAttendanceOwner({
        isAttendance: true,
        operator: 'user-123',
      }),
    ).toEqual({ userId: 'user-123' });
  });

  it('extracts _id and full name from populated operator', () => {
    expect(
      extractAttendanceOwner({
        isAttendance: true,
        operator: {
          _id: 'user-42',
          firstName: 'Ana',
          lastName: 'Costa',
        } as unknown as string,
      }),
    ).toEqual({ userId: 'user-42', name: 'Ana Costa' });
  });

  it('handles a populated operator with only firstName', () => {
    expect(
      extractAttendanceOwner({
        isAttendance: true,
        operator: {
          _id: 'user-42',
          firstName: 'Ana',
        } as unknown as string,
      }),
    ).toEqual({ userId: 'user-42', name: 'Ana' });
  });

  it('returns undefined name when both first/last are missing', () => {
    expect(
      extractAttendanceOwner({
        isAttendance: true,
        operator: { _id: 'user-42' } as unknown as string,
      }),
    ).toEqual({ userId: 'user-42', name: undefined });
  });
});

describe('takeover protection scenarios', () => {
  it('Operator B sees a locked state after Operator A claims', () => {
    const claimedByA = mkEvent({
      isAttendance: true,
      status: 'IN_PROGRESS',
      operator: {
        _id: USER_A,
        firstName: 'Op',
        lastName: 'A',
      } as unknown as string,
    });

    // Operator A's screen
    expect(classifyAttendance(claimedByA, USER_A)).toBe('IN_PROGRESS_BY_ME');
    // Operator B's screen
    expect(classifyAttendance(claimedByA, USER_B)).toBe('IN_PROGRESS_BY_OTHER');
    // Anonymous viewer (e.g. AUDITOR role not yet loaded)
    expect(classifyAttendance(claimedByA, undefined)).toBe('IN_PROGRESS_BY_OTHER');
  });

  it('After close, both operators see CLOSED - no takeover is possible', () => {
    const closed = mkEvent({
      isAttendance: true,
      status: 'CLOSED',
      operator: { _id: USER_A } as unknown as string,
      openedDate: '2025-01-01T12:00:00Z',
      closedDate: '2025-01-01T12:30:00Z',
    });
    expect(classifyAttendance(closed, USER_A)).toBe('CLOSED');
    expect(classifyAttendance(closed, USER_B)).toBe('CLOSED');
  });
});
