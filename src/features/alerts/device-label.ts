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
 * Device identifier fallback chain. Para tipos como OCCURRENCE_MISSED,
 * o device nunca reportou (não atendeu o alerta), então `deviceInfo.deviceId`
 * costuma vir vazio. Cai pra `equipment.code` (humano-amigável, vem do QR
 * do site), depois `serialNumber`, depois `_id` como último recurso.
 */
function resolveDeviceIdString(event: Pick<PatrolAction, 'deviceInfo' | 'equipment'>): string {
  const direct = event.deviceInfo?.deviceId;
  if (direct) return String(direct);

  const eq = event.equipment;
  if (eq && typeof eq === 'object') {
    const obj = eq as { code?: string; serialNumber?: string; _id?: string };
    if (obj.code) return String(obj.code);
    if (obj.serialNumber) return String(obj.serialNumber);
    if (obj._id) return String(obj._id);
  }
  return '';
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
export function formatDeviceLabel(
  event: Pick<PatrolAction, 'site' | 'deviceInfo' | 'equipment'>,
): string {
  const name = siteName(event.site);
  const last4 = lastFourOfDevice(resolveDeviceIdString(event));

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
