import type { Company, PatrolAction } from '@/types/api';

const DEFAULT_FALLBACK = 'Dispositivo AlertPort';

function lastFourOfDevice(deviceId: string | undefined | null): string {
  if (!deviceId) return '';
  const cleaned = String(deviceId).trim();
  if (!cleaned) return '';
  return cleaned.slice(-4);
}

function siteName(site: PatrolAction['site']): string {
  if (!site) return '';
  if (typeof site === 'string') return '';
  return (site as Company).name || '';
}

/**
 * Human-readable label for a device associated with a patrol-action event.
 *
 * Format: `${siteName} - ${last4 of deviceId}`.
 *   - "Hospital Brasil - 02b2"
 *
 * Fallbacks (in order):
 *   - site present but device missing  → just the site name
 *   - site missing but device present  → "Dispositivo …02b2"
 *   - both missing                      → "Dispositivo AlertPort"
 */
export function formatDeviceLabel(event: Pick<PatrolAction, 'site' | 'deviceInfo'>): string {
  const name = siteName(event.site);
  const last4 = lastFourOfDevice(event.deviceInfo?.deviceId);

  if (name && last4) return `${name} - ${last4}`;
  if (name) return name;
  if (last4) return `Dispositivo …${last4}`;
  return DEFAULT_FALLBACK;
}

/**
 * Returns the socket `userId` to pass as `to` on `call:start`. The AlertPort
 * app registers with its `deviceId` as the socket userId, so this field is the
 * correct call target. Do NOT fall back to `event.user._id` or
 * `event.equipment._id` - those are different IDs.
 */
export function resolveCallTargetId(event: Pick<PatrolAction, 'deviceInfo'>): string | null {
  const id = event.deviceInfo?.deviceId;
  return id ? String(id) : null;
}
