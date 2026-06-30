import { describe, expect, test } from 'vitest';
import {
  IN_PROGRESS_GROUP,
  MONITOR_CATEGORIES,
  MONITOR_EVENT_TYPES,
  filterMonitorEvents,
  tagToFilters,
  type MonitorCategory,
  type MonitorClientFilters,
} from './monitor-filter';
import type { AttendanceState } from './attendance-state';
import type { EventType, PatrolAction } from '@/types/api';

const POWER_EVENT_TYPES: EventType[] = [
  'DEVICE_AC_LOST',
  'DEVICE_AC_RESTORED',
  'DEVICE_BATTERY_LOW',
];

const makeEvent = (type: EventType): PatrolAction =>
  ({ _id: type, type }) as unknown as PatrolAction;

/**
 * Build a PatrolAction whose attendance object classifies into the given
 * {@link AttendanceState} for the supplied operator. Mirrors the shape
 * consumed by `classifyAttendance` (isAttendance + status + operator._id).
 */
const makeAttendanceEvent = (
  state: AttendanceState,
  id: string,
  currentUserId = 'me',
): PatrolAction => {
  const base = { _id: id, type: 'SOS_ALERT' as EventType };
  switch (state) {
    case 'AVAILABLE':
      return base as unknown as PatrolAction;
    case 'CLOSED':
      return {
        ...base,
        attendance: { isAttendance: true, status: 'CLOSED' },
      } as unknown as PatrolAction;
    case 'IN_PROGRESS_BY_ME':
      return {
        ...base,
        attendance: { isAttendance: true, status: 'IN_PROGRESS', operator: { _id: currentUserId } },
      } as unknown as PatrolAction;
    case 'IN_PROGRESS_BY_OTHER':
      return {
        ...base,
        attendance: {
          isAttendance: true,
          status: 'IN_PROGRESS',
          operator: { _id: 'someone-else' },
        },
      } as unknown as PatrolAction;
  }
};

const noLabel = (): string | undefined => undefined;

const baseFilters: MonitorClientFilters = {
  q: '',
  type: '',
  status: '',
  category: '',
};

describe('MONITOR_EVENT_TYPES', () => {
  test('includes the three power/battery event types', () => {
    // Arrange / Act
    const present = POWER_EVENT_TYPES.every((type) => MONITOR_EVENT_TYPES.includes(type));

    // Assert
    expect(present).toBe(true);
  });

  test('excludes the JWM patrol types AlertPort does not track', () => {
    // Arrange
    const jwmPatrolTypes: EventType[] = ['INCIDENT', 'CRASH', 'CANCEL_PATROL', 'FAILURE_PATROL'];

    // Act
    const anyPresent = jwmPatrolTypes.some((type) => MONITOR_EVENT_TYPES.includes(type));

    // Assert
    expect(anyPresent).toBe(false);
  });

  test('keeps the supported AlertPort event types', () => {
    // Arrange
    const supported: EventType[] = [
      'SOS_ALERT',
      'LOWVOLTAGE',
      'OCCURRENCE_MISSED',
      'DEVICE_AC_LOST',
      'DEVICE_AC_RESTORED',
      'DEVICE_BATTERY_LOW',
    ];

    // Act
    const allPresent = supported.every((type) => MONITOR_EVENT_TYPES.includes(type));

    // Assert
    expect(allPresent).toBe(true);
  });
});

describe('MONITOR_CATEGORIES', () => {
  test('includes the POWER_EVENT category', () => {
    expect(MONITOR_CATEGORIES).toContain<MonitorCategory>('POWER_EVENT');
  });
});

describe('filterMonitorEvents — POWER_EVENT category mapping', () => {
  test('POWER_EVENT category keeps only the three power/battery types', () => {
    // Arrange
    const events = [
      ...POWER_EVENT_TYPES.map(makeEvent),
      makeEvent('SOS_ALERT'),
      makeEvent('OCCURRENCE_MISSED'),
    ];

    // Act
    const result = filterMonitorEvents(
      events,
      { ...baseFilters, category: 'POWER_EVENT' },
      undefined,
      noLabel,
    );

    // Assert
    expect(result.map((event) => event.type).sort()).toEqual([...POWER_EVENT_TYPES].sort());
  });

  test('SOS category excludes power/battery events', () => {
    // Arrange
    const events = [makeEvent('SOS_ALERT'), ...POWER_EVENT_TYPES.map(makeEvent)];

    // Act
    const result = filterMonitorEvents(
      events,
      { ...baseFilters, category: 'SOS' },
      undefined,
      noLabel,
    );

    // Assert
    expect(result.map((event) => event.type)).toEqual(['SOS_ALERT']);
  });

  test('type filter narrows to a single power event type', () => {
    // Arrange
    const events = POWER_EVENT_TYPES.map(makeEvent);

    // Act
    const result = filterMonitorEvents(
      events,
      { ...baseFilters, type: 'DEVICE_BATTERY_LOW' },
      undefined,
      noLabel,
    );

    // Assert
    expect(result.map((event) => event.type)).toEqual(['DEVICE_BATTERY_LOW']);
  });
});

describe('tagToFilters', () => {
  test("SOS tag → category 'SOS', no status", () => {
    expect(tagToFilters('SOS')).toEqual({ category: 'SOS', status: '' });
  });

  test("AVAILABLE tag → status 'AVAILABLE', no category", () => {
    expect(tagToFilters('AVAILABLE')).toEqual({ category: '', status: 'AVAILABLE' });
  });

  test('IN_PROGRESS tag → status group IN_PROGRESS, no category', () => {
    expect(tagToFilters('IN_PROGRESS')).toEqual({ category: '', status: IN_PROGRESS_GROUP });
  });

  test('empty tag clears both category and status', () => {
    expect(tagToFilters('')).toEqual({ category: '', status: '' });
  });
});

describe('filterMonitorEvents — IN_PROGRESS_GROUP status filter', () => {
  const currentUserId = 'me';

  test('keeps both IN_PROGRESS_BY_ME and IN_PROGRESS_BY_OTHER, drops AVAILABLE/CLOSED', () => {
    // Arrange
    const events = [
      makeAttendanceEvent('AVAILABLE', 'a', currentUserId),
      makeAttendanceEvent('IN_PROGRESS_BY_ME', 'mine', currentUserId),
      makeAttendanceEvent('IN_PROGRESS_BY_OTHER', 'theirs', currentUserId),
      makeAttendanceEvent('CLOSED', 'done', currentUserId),
    ];

    // Act
    const result = filterMonitorEvents(
      events,
      { ...baseFilters, status: IN_PROGRESS_GROUP },
      currentUserId,
      noLabel,
    );

    // Assert
    expect(result.map((event) => event._id).sort()).toEqual(['mine', 'theirs']);
  });

  test('a single concrete status (IN_PROGRESS_BY_ME) does not match the other operator', () => {
    // Arrange — the status dropdown selects one concrete state, unaffected by the group.
    const events = [
      makeAttendanceEvent('IN_PROGRESS_BY_ME', 'mine', currentUserId),
      makeAttendanceEvent('IN_PROGRESS_BY_OTHER', 'theirs', currentUserId),
    ];

    // Act
    const result = filterMonitorEvents(
      events,
      { ...baseFilters, status: 'IN_PROGRESS_BY_ME' },
      currentUserId,
      noLabel,
    );

    // Assert
    expect(result.map((event) => event._id)).toEqual(['mine']);
  });
});
