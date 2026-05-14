import type { Company, PatrolAction } from '@/types/api';

const DEFAULT_FALLBACK = 'Dispositivo AlertPort';

function lastFourOfDevice(deviceId: string | undefined | null): string {
  if (!deviceId) return '';
  const cleaned = String(deviceId).trim();
  if (!cleaned) return '';
  return cleaned.slice(-4);
}

function companyName(value: string | Company | undefined | null): string {
  if (!value) return '';
  if (typeof value === 'string') return '';
  return (value as Company).name || '';
}

/**
 * Device identifier fallback chain. Para tipos como OCCURRENCE_MISSED,
 * o device nunca reportou (não atendeu o alerta), então `deviceInfo.deviceId`
 * costuma vir vazio. Cai pra `equipment.uniqueId` (IMEI/SN — populado em
 * devices AlertPort e em GWRonda legacy importados), depois `equipment.code`,
 * `serialNumber` e `_id` como último recurso.
 */
function resolveDeviceIdString(event: Pick<PatrolAction, 'deviceInfo' | 'equipment'>): string {
  const direct = event.deviceInfo?.deviceId;
  if (direct) return String(direct);

  const eq = event.equipment;
  if (eq && typeof eq === 'object') {
    const obj = eq as { uniqueId?: string; code?: string; serialNumber?: string; _id?: string };
    if (obj.uniqueId) return String(obj.uniqueId);
    if (obj.code) return String(obj.code);
    if (obj.serialNumber) return String(obj.serialNumber);
    if (obj._id) return String(obj._id);
  }
  return '';
}

/**
 * Human-readable label for a device associated with a patrol-action event.
 *
 * Format: `${siteOrClientName} - ${last4 of deviceId}`.
 *   - "Hospital Brasil - 02b2"
 *
 * Fallback chain for the "name" segment:
 *   - site populated  → `site.name` (fluxo AlertPort nativo)
 *   - site ausente    → `client.name` (GWRonda legacy: equipments
 *                       importados sem site, só client populado — evita
 *                       o operador ver apenas "Dispositivo …xxxx")
 *
 * Fallbacks finais quando o nome ainda for vazio:
 *   - device presente → "Dispositivo …02b2"
 *   - tudo ausente    → "Dispositivo AlertPort"
 */
export function formatDeviceLabel(
  event: Pick<PatrolAction, 'site' | 'client' | 'deviceInfo' | 'equipment'>,
): string {
  const name = companyName(event.site) || companyName(event.client);
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

/**
 * GWRonda legacy actions originate from read-only AlertPort devices via the
 * SQL bridge (see ms-worker-events). The hardware has no audio capability
 * so call buttons must stay hidden on the monitor card. Attendance flow
 * remains available.
 *
 * Heuristic: presence of any legacy marker. The worker always sets at least
 * `legacyEventId` on GWRonda-sourced actions.
 */
export function isLegacyGwrondaAction(
  event: Pick<PatrolAction, 'legacyEventId' | 'legacyEventType' | 'legacyReaderCode'>,
): boolean {
  return Boolean(event.legacyEventId || event.legacyEventType || event.legacyReaderCode);
}
