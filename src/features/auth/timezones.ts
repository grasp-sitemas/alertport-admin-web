/**
 * Curated list of frequently-used IANA timezones, surfaced as quick-pick
 * chips next to the signup timezone input. The full IANA list is attached
 * to a <datalist> for autocomplete fallback.
 */
export const COMMON_TIMEZONES: string[] = [
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Manaus',
  'America/Rio_Branco',
  'America/New_York',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Buenos_Aires',
  'America/Bogota',
  'America/Lima',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Johannesburg',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

const FALLBACK_TIMEZONES: string[] = COMMON_TIMEZONES;

/**
 * Returns the full list of IANA timezones supported by the runtime, or a
 * curated fallback when Intl.supportedValuesOf is unavailable.
 *
 * `detected` is prepended (deduped) so the user's best match shows up first.
 */
export function getAllTimezones(detected?: string): string[] {
  let list: string[];
  try {
    // Intl.supportedValuesOf is Stage 4 + ships in Node 18+ and all current browsers.
    // Fall back defensively just in case.
    const anyIntl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    list = anyIntl.supportedValuesOf?.('timeZone') ?? FALLBACK_TIMEZONES;
  } catch {
    list = FALLBACK_TIMEZONES;
  }
  if (!list || list.length === 0) list = FALLBACK_TIMEZONES;
  if (detected && !list.includes(detected)) {
    return [detected, ...list];
  }
  return list;
}
