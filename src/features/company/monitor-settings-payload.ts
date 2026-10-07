import type { CompanySettings } from '@/types/api';

/**
 * Body for {@link companyService.updateSettings}. The backend selects
 * the account from the authenticated ADMIN session.
 */
export interface MonitorSettingsUpdate {
  body: {
    monitor: {
      eventFilters: NonNullable<CompanySettings['monitor']>['eventFilters'];
      callRecordingEnabled: boolean;
      eventTimeWindowHours: number | null;
    };
    status: NonNullable<CompanySettings['status']>;
  };
}

/**
 * Build the PUT payload that saves the monitor time-window.
 *
 * Why this is its own pure function: the backend `saveOrUpdate` requires a
 * non-empty `monitor.eventFilters` array and preserves the other monitor
 * flags, so the PUT must echo back the loaded `eventFilters` /
 * `callRecordingEnabled` and only change `eventTimeWindowHours`. Dropping the
 * echo-back wipes the account's event filters. An empty input clears the
 * window (system default → `null`); a filled value is sent as a number.
 *
 * @param current Settings loaded from the server (may be undefined before load).
 * @param rawHours The raw form value (string); empty/whitespace → null.
 */
export function buildMonitorSettingsUpdate(
  current: CompanySettings | undefined,
  rawHours: string,
): MonitorSettingsUpdate {
  const trimmed = rawHours.trim();
  const eventTimeWindowHours = trimmed === '' ? null : Number(trimmed);

  return {
    body: {
      monitor: {
        eventFilters: current?.monitor?.eventFilters ?? [],
        callRecordingEnabled: current?.monitor?.callRecordingEnabled ?? false,
        eventTimeWindowHours,
      },
      status: current?.status ?? 'ACTIVE',
    },
  };
}
