import { describe, expect, test } from 'vitest';
import type { Equipment } from '@/types/api';
import { devicePresenceId, shouldQueryPresence } from './offline-devices-panel';

const makeEquipment = (overrides: Partial<Equipment>): Equipment =>
  ({ _id: 'eq-id', code: 'EQ', status: 'ACTIVE', ...overrides }) as Equipment;

/**
 * Presence cross-reference logic. The device registers on ms-chat with
 * `uniqueId` as its socket userId, falling back to `_id`. Getting this
 * priority wrong silently mis-classifies every device's online state.
 */
describe('devicePresenceId', () => {
  test('prefers uniqueId over _id', () => {
    const eq = makeEquipment({ uniqueId: 'imei-123', _id: 'mongo-id' });
    expect(devicePresenceId(eq)).toBe('imei-123');
  });

  test('falls back to _id when uniqueId is absent', () => {
    const eq = makeEquipment({ uniqueId: undefined, _id: 'mongo-id' });
    expect(devicePresenceId(eq)).toBe('mongo-id');
  });

  test('falls back to _id when uniqueId is an empty string', () => {
    const eq = makeEquipment({ uniqueId: '', _id: 'mongo-id' });
    expect(devicePresenceId(eq)).toBe('mongo-id');
  });

  test('returns null when neither identifier is present', () => {
    const eq = makeEquipment({ uniqueId: '', _id: '' });
    expect(devicePresenceId(eq)).toBeNull();
  });
});

/**
 * Race-guard: the equipment query must only fire once the live presence
 * list is populated. `undefined` (socket unavailable) and `[]` (first
 * connect, before user:list broadcast) both mean "do not query yet".
 */
describe('shouldQueryPresence', () => {
  test('false when onlineUserIds is undefined (socket unavailable)', () => {
    expect(shouldQueryPresence(undefined)).toBe(false);
  });

  test('false when onlineUserIds is empty (first-connect race)', () => {
    expect(shouldQueryPresence([])).toBe(false);
  });

  test('true when at least one device is online', () => {
    expect(shouldQueryPresence(['dev-1'])).toBe(true);
  });
});
