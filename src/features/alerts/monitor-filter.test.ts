import { describe, expect, test } from 'vitest';
import {
  MONITOR_CATEGORIES,
  MONITOR_EVENT_TYPES,
  filterMonitorEvents,
  type MonitorCategory,
  type MonitorClientFilters,
} from './monitor-filter';
import type { EventType, PatrolAction } from '@/types/api';

const POWER_EVENT_TYPES: EventType[] = [
  'DEVICE_AC_LOST',
  'DEVICE_AC_RESTORED',
  'DEVICE_BATTERY_LOW',
];

const makeEvent = (type: EventType): PatrolAction =>
  ({ _id: type, type }) as unknown as PatrolAction;

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
