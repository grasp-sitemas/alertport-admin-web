/**
 * Event geolocation — resolver + formatter.
 *
 * An AlertPort device attaches the user's coordinates to every event it
 * creates (SOS, INCIDENT, etc.). The capture lives in
 * `alertport-app/src/Hooks/useGetGeolocation.ts` and is written to the
 * Firestore document that ms-patrolhub persists to Mongo.
 *
 * On the way back out, the API may expose the coordinates in one of three
 * spots depending on who composed the response — the worker sometimes
 * promotes them to the top level, the legacy vigilante flow emits them
 * nested under `deviceInfo`, and the shieldgo web used to hold a
 * `{ lat, lng }` shape on `location` for a few event types. This helper
 * normalizes the three shapes into a single `{ latitude, longitude }`
 * tuple of numbers or returns `null` when nothing usable is present.
 *
 * Kept pure + side-effect-free so the card can call it during render
 * without memoization overhead.
 */
import type { PatrolAction } from '@/types/api';

export interface EventGeolocation {
  latitude: number;
  longitude: number;
  /**
   * The source the coordinates came from — useful for debugging and
   * testing. Not shown to the operator.
   */
  source: 'event' | 'deviceInfo' | 'location';
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // (0,0) is technically valid but almost always means "GPS was never
    // acquired before the payload was dispatched" — hide it so the
    // operator doesn't get dragged to Null Island.
    !(lat === 0 && lng === 0)
  );
}

/**
 * Pull geolocation off a PatrolAction, regardless of which of the three
 * legacy shapes the server happened to emit.
 *
 * Priority order mirrors how fresh data reaches us:
 *   1. top-level `geolocation` (AlertPort app → ms-patrolhub → Mongo)
 *   2. `deviceInfo.geolocation` (shieldgo vigilante nested shape)
 *   3. `location` (pre-existing UI placeholder; never populated by the
 *      AlertPort pipeline but kept as a safety net)
 */
export function resolveEventGeolocation(
  event: Pick<PatrolAction, 'geolocation' | 'deviceInfo' | 'location'>,
): EventGeolocation | null {
  const top = event.geolocation;
  if (top) {
    const lat = toFiniteNumber(top.latitude);
    const lng = toFiniteNumber(top.longitude);
    if (lat !== null && lng !== null && isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng, source: 'event' };
    }
  }

  const device = event.deviceInfo?.geolocation;
  if (device) {
    const lat = toFiniteNumber(device.latitude);
    const lng = toFiniteNumber(device.longitude);
    if (lat !== null && lng !== null && isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng, source: 'deviceInfo' };
    }
  }

  const legacy = event.location;
  if (legacy) {
    const lat = toFiniteNumber(legacy.lat);
    const lng = toFiniteNumber(legacy.lng);
    if (lat !== null && lng !== null && isValidLatLng(lat, lng)) {
      return { latitude: lat, longitude: lng, source: 'location' };
    }
  }

  return null;
}

/**
 * Short label for the card: four decimals give ~11 m precision, matching
 * what a GPS fix actually delivers on a phone (street-level but not
 * roof-level). Avoids fake over-precision and keeps the card compact.
 */
export function formatCoordinates(coords: EventGeolocation): string {
  return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
}

/**
 * Google Maps deep link. The `q` form works on both maps.google.com
 * and the mobile Google Maps app via universal links (no API key
 * required, no usage cost).
 */
export function buildMapsUrl(coords: EventGeolocation): string {
  return `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
}

/**
 * Embed map URL for iframe rendering inside monitor modal.
 */
export function buildMapsEmbedUrl(coords: EventGeolocation): string {
  return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}&z=16&output=embed`;
}
