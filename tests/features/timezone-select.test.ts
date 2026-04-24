/**
 * `TimezoneSelect` rendering is exercised by integration tests elsewhere;
 * this file covers the pure helpers behind it:
 *   - `buildTimezoneChips`: chip ordering (detected first, deduped,
 *     capped) — the single piece of business logic users see.
 *   - `detectBrowserTimezone`: fallback when Intl is unavailable, since
 *     the register + /companies forms rely on this for default values.
 *
 * Also re-asserts the invariants of `getAllTimezones` + `companyListFormSchema`
 * so a future refactor that silently drops the timezone field fails loudly.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildTimezoneChips,
  detectBrowserTimezone,
} from '@/components/shared/timezone-select';
import {
  COMMON_TIMEZONES,
  getAllTimezones,
} from '@/features/auth/timezones';
import {
  companyListFormSchema,
  DEFAULT_COMPANY_LIST_VALUES,
} from '@/features/company/schemas';

describe('buildTimezoneChips', () => {
  it('puts the detected zone first', () => {
    const chips = buildTimezoneChips('America/Sao_Paulo');
    expect(chips[0]).toBe('America/Sao_Paulo');
  });

  it('dedupes the detected zone out of the suggested list', () => {
    const chips = buildTimezoneChips('America/Sao_Paulo', [
      'America/Sao_Paulo',
      'Europe/Lisbon',
    ]);
    const occurrences = chips.filter((tz) => tz === 'America/Sao_Paulo');
    expect(occurrences).toHaveLength(1);
  });

  it('caps the chip row at six by default to avoid wrapping', () => {
    const many = [
      'UTC',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Dubai',
      'Pacific/Auckland',
    ];
    const chips = buildTimezoneChips('America/Sao_Paulo', many);
    expect(chips).toHaveLength(6);
  });

  it('honors a custom cap', () => {
    const chips = buildTimezoneChips('UTC', COMMON_TIMEZONES, 3);
    expect(chips).toHaveLength(3);
  });

  it('preserves the suggested ordering after the detected zone', () => {
    const chips = buildTimezoneChips('UTC', ['Europe/Lisbon', 'Asia/Tokyo']);
    expect(chips).toEqual(['UTC', 'Europe/Lisbon', 'Asia/Tokyo']);
  });
});

describe('detectBrowserTimezone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns whatever Intl reports when the API works', () => {
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'Europe/Berlin' }),
      } as unknown as Intl.DateTimeFormat);

    expect(detectBrowserTimezone()).toBe('Europe/Berlin');
    spy.mockRestore();
  });

  it('falls back to America/Sao_Paulo when Intl resolves an empty timezone', () => {
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockReturnValue({
        resolvedOptions: () => ({ timeZone: '' }),
      } as unknown as Intl.DateTimeFormat);

    expect(detectBrowserTimezone()).toBe('America/Sao_Paulo');
    spy.mockRestore();
  });

  it('falls back when Intl throws (exotic Node runtimes)', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(detectBrowserTimezone()).toBe('America/Sao_Paulo');
    spy.mockRestore();
  });
});

describe('getAllTimezones', () => {
  it('prepends the detected zone when it is not already in the list', () => {
    const result = getAllTimezones('Mars/Olympus_Mons');
    expect(result[0]).toBe('Mars/Olympus_Mons');
  });

  it('does not prepend when the detected zone is already included', () => {
    const result = getAllTimezones('UTC');
    const firstUtcIndex = result.indexOf('UTC');
    const secondUtcIndex = result.indexOf('UTC', firstUtcIndex + 1);
    expect(secondUtcIndex).toBe(-1);
  });
});

describe('companyListFormSchema — timezone integration', () => {
  it('accepts a valid IANA timezone string', () => {
    const parsed = companyListFormSchema.parse({
      ...DEFAULT_COMPANY_LIST_VALUES,
      name: 'Acme',
      timezone: 'America/Sao_Paulo',
    });
    expect(parsed.timezone).toBe('America/Sao_Paulo');
  });

  it('accepts the field being omitted (optional)', () => {
    const parsed = companyListFormSchema.parse({
      ...DEFAULT_COMPANY_LIST_VALUES,
      name: 'Acme',
      timezone: undefined,
    });
    expect(parsed.timezone).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    const parsed = companyListFormSchema.parse({
      ...DEFAULT_COMPANY_LIST_VALUES,
      name: 'Acme',
      timezone: '  Europe/Lisbon  ',
    });
    expect(parsed.timezone).toBe('Europe/Lisbon');
  });
});
