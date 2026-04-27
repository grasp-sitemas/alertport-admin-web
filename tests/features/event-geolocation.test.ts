/**
 * `resolveEventGeolocation` normalizes the three shapes the backend can
 * expose for an event's coordinates into a single `{ latitude, longitude }`
 * tuple. These tests also cover the "never show Null Island" safety
 * filter that hides uninitialized (0, 0) fixes — the most common cause
 * of operators being dragged to the Atlantic Ocean pre-fix.
 */

import { describe, expect, it } from 'vitest';
import {
  buildMapsEmbedUrl,
  buildMapsUrl,
  formatCoordinates,
  resolveEventGeolocation,
} from '@/features/alerts/event-geolocation';
import type { PatrolAction } from '@/types/api';

function make(partial: Partial<PatrolAction>): PatrolAction {
  return {
    _id: 'evt_x',
    type: 'SOS_ALERT',
    status: 'ACTIVE',
    ...partial,
  };
}

describe('resolveEventGeolocation', () => {
  it('reads numeric latitude/longitude from the top-level geolocation field', () => {
    const coords = resolveEventGeolocation(
      make({ geolocation: { latitude: -23.55, longitude: -46.63 } }),
    );
    expect(coords).toEqual({
      latitude: -23.55,
      longitude: -46.63,
      source: 'event',
    });
  });

  it('coerces string latitude/longitude (the app sometimes stringifies them)', () => {
    const coords = resolveEventGeolocation(
      make({ geolocation: { latitude: '-23.55', longitude: '-46.63' } }),
    );
    expect(coords?.latitude).toBe(-23.55);
    expect(coords?.longitude).toBe(-46.63);
  });

  it('falls back to deviceInfo.geolocation when top-level is missing', () => {
    const coords = resolveEventGeolocation(
      make({
        deviceInfo: {
          deviceId: 'abc',
          geolocation: { latitude: 10, longitude: 20 },
        },
      }),
    );
    expect(coords).toEqual({ latitude: 10, longitude: 20, source: 'deviceInfo' });
  });

  it('falls back to the legacy location field as last resort', () => {
    const coords = resolveEventGeolocation(
      make({ location: { lat: 1.5, lng: 2.5 } }),
    );
    expect(coords).toEqual({ latitude: 1.5, longitude: 2.5, source: 'location' });
  });

  it('returns null when no coordinates are present', () => {
    expect(resolveEventGeolocation(make({}))).toBeNull();
  });

  it('returns null for (0, 0) — the "GPS never acquired" sentinel', () => {
    expect(
      resolveEventGeolocation(make({ geolocation: { latitude: 0, longitude: 0 } })),
    ).toBeNull();
  });

  it('returns null when latitude is out of [-90, 90]', () => {
    expect(
      resolveEventGeolocation(make({ geolocation: { latitude: 999, longitude: 0 } })),
    ).toBeNull();
  });

  it('returns null when longitude is out of [-180, 180]', () => {
    expect(
      resolveEventGeolocation(make({ geolocation: { latitude: 0, longitude: 999 } })),
    ).toBeNull();
  });

  it('returns null when coordinates are non-numeric strings', () => {
    expect(
      resolveEventGeolocation(
        make({ geolocation: { latitude: 'n/a', longitude: 'n/a' } }),
      ),
    ).toBeNull();
  });

  it('prefers top-level over deviceInfo when both are present', () => {
    const coords = resolveEventGeolocation(
      make({
        geolocation: { latitude: 1, longitude: 2 },
        deviceInfo: {
          geolocation: { latitude: 999, longitude: 999 },
        },
      }),
    );
    expect(coords?.source).toBe('event');
    expect(coords?.latitude).toBe(1);
  });

  it('skips top-level when it only has an invalid value and falls back to deviceInfo', () => {
    const coords = resolveEventGeolocation(
      make({
        geolocation: { latitude: 0, longitude: 0 },
        deviceInfo: {
          geolocation: { latitude: -23.55, longitude: -46.63 },
        },
      }),
    );
    expect(coords?.source).toBe('deviceInfo');
  });
});

describe('formatCoordinates', () => {
  it('formats with four decimal places for street-level precision', () => {
    expect(
      formatCoordinates({ latitude: -23.550123, longitude: -46.633456, source: 'event' }),
    ).toBe('-23.5501, -46.6335');
  });
});

describe('buildMapsUrl', () => {
  it('generates a no-key Google Maps search link', () => {
    const url = buildMapsUrl({
      latitude: -23.55,
      longitude: -46.63,
      source: 'event',
    });
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=-23.55,-46.63',
    );
  });
});

describe('buildMapsEmbedUrl', () => {
  it('generates a Google Maps embed link for iframe usage', () => {
    const url = buildMapsEmbedUrl({
      latitude: -23.55,
      longitude: -46.63,
      source: 'event',
    });
    expect(url).toBe('https://www.google.com/maps?q=-23.55,-46.63&z=16&output=embed');
  });
});
