import { describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDevicePresence } from './use-device-presence';

/**
 * Pure presence logic: `useDevicePresence` derives an `onlineDeviceIds` set
 * and an `isOffline` predicate from the live ms-chat `user:list`. The
 * load-bearing invariant is "never flag an unknown id as offline" — a null
 * or undefined presence id must return false so the offline panel never
 * lists a device it cannot classify.
 */
describe('useDevicePresence', () => {
  test('isOffline(null) returns false — never flag an unknown id', () => {
    // Arrange
    const { result } = renderHook(() => useDevicePresence(['dev-1']));

    // Act / Assert
    expect(result.current.isOffline(null)).toBe(false);
  });

  test('isOffline(undefined) returns false — never flag an unknown id', () => {
    // Arrange
    const { result } = renderHook(() => useDevicePresence(['dev-1']));

    // Act / Assert
    expect(result.current.isOffline(undefined)).toBe(false);
  });

  test('isOffline(id not in online set) returns true', () => {
    // Arrange
    const { result } = renderHook(() => useDevicePresence(['dev-online']));

    // Act / Assert
    expect(result.current.isOffline('dev-missing')).toBe(true);
  });

  test('isOffline(id in online set) returns false', () => {
    // Arrange
    const { result } = renderHook(() => useDevicePresence(['dev-online']));

    // Act / Assert
    expect(result.current.isOffline('dev-online')).toBe(false);
  });

  test('onlineDeviceIds is empty when onlineUserIds is undefined', () => {
    // Arrange
    const { result } = renderHook(() => useDevicePresence(undefined));

    // Act / Assert
    expect(result.current.onlineDeviceIds.size).toBe(0);
    // And every lookup is "not offline" — the panel gates on presence
    // availability rather than flagging every device.
    expect(result.current.isOffline('anything')).toBe(false);
  });

  test('onlineDeviceIds mirrors the provided online list', () => {
    // Arrange
    const { result } = renderHook(() => useDevicePresence(['a', 'b']));

    // Act / Assert
    expect([...result.current.onlineDeviceIds].sort()).toEqual(['a', 'b']);
  });
});
