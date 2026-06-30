import { describe, expect, test } from 'vitest';
import type { CompanySettings } from '@/types/api';
import { buildMonitorSettingsUpdate } from './monitor-settings-payload';

const settings: CompanySettings = {
  _id: 'settings-1',
  account: 'acc-1',
  status: 'ACTIVE',
  monitor: {
    eventFilters: [{ type: 'SOS_ALERT', enabled: true }],
    callRecordingEnabled: true,
    eventTimeWindowHours: 6,
  },
};

describe('buildMonitorSettingsUpdate', () => {
  test('echoes back the loaded eventFilters (dropping them wipes the account config)', () => {
    const { body } = buildMonitorSettingsUpdate(settings, '12');
    expect(body.monitor.eventFilters).toEqual([{ type: 'SOS_ALERT', enabled: true }]);
  });

  test('echoes back callRecordingEnabled and status unchanged', () => {
    const { body } = buildMonitorSettingsUpdate(settings, '12');
    expect(body.monitor.callRecordingEnabled).toBe(true);
    expect(body.status).toBe('ACTIVE');
  });

  test('sends a number when the window is filled', () => {
    const { body } = buildMonitorSettingsUpdate(settings, '12');
    expect(body.monitor.eventTimeWindowHours).toBe(12);
  });

  test('sends null when the window is cleared (system default)', () => {
    const { body } = buildMonitorSettingsUpdate(settings, '');
    expect(body.monitor.eventTimeWindowHours).toBeNull();
  });

  test('treats a whitespace-only window as cleared (null)', () => {
    const { body } = buildMonitorSettingsUpdate(settings, '   ');
    expect(body.monitor.eventTimeWindowHours).toBeNull();
  });

  test('prefers the immutable account FK as the target id', () => {
    const { targetId } = buildMonitorSettingsUpdate(settings, '12');
    expect(targetId).toBe('acc-1');
  });

  test('falls back to _id when account is absent', () => {
    const { targetId } = buildMonitorSettingsUpdate({ ...settings, account: undefined }, '12');
    expect(targetId).toBe('settings-1');
  });

  test('defaults to an empty eventFilters array and ACTIVE status when settings are unloaded', () => {
    const { targetId, body } = buildMonitorSettingsUpdate(undefined, '');
    expect(targetId).toBe('');
    expect(body.monitor.eventFilters).toEqual([]);
    expect(body.monitor.callRecordingEnabled).toBe(false);
    expect(body.monitor.eventTimeWindowHours).toBeNull();
    expect(body.status).toBe('ACTIVE');
  });
});
