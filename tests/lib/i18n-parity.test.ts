import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Locale parity guard. pt is the canonical locale (CLAUDE.md / i18n.md);
 * every other locale must have EXACTLY the same flattened key set — both
 * directions. A missing key surfaces a literal `users.title` in the UI; an
 * orphan key is dead translation that drifts over time. This test fails loud
 * the moment a key is added to one locale and not the others.
 */
const LOCALES = ['pt', 'en', 'es', 'ja', 'zh'] as const;
type Locale = (typeof LOCALES)[number];

const MESSAGES_DIR = path.resolve(__dirname, '../../src/messages');

function flatten(
  obj: Record<string, unknown>,
  prefix = '',
  out: Set<string> = new Set(),
): Set<string> {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Record<string, unknown>, fullKey, out);
    } else {
      out.add(fullKey);
    }
  }
  return out;
}

function loadKeys(locale: Locale): Set<string> {
  const raw = readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8');
  return flatten(JSON.parse(raw) as Record<string, unknown>);
}

describe('i18n locale parity (pt is canonical)', () => {
  const ptKeys = loadKeys('pt');

  test('pt has a non-trivial number of keys (sanity)', () => {
    expect(ptKeys.size).toBeGreaterThan(100);
  });

  for (const locale of LOCALES.filter((l) => l !== 'pt')) {
    const localeKeys = loadKeys(locale);

    test(`${locale} is missing no keys that pt has`, () => {
      const missing = [...ptKeys].filter((key) => !localeKeys.has(key)).sort();
      expect(missing).toEqual([]);
    });

    test(`${locale} has no orphan keys absent from pt`, () => {
      const orphan = [...localeKeys].filter((key) => !ptKeys.has(key)).sort();
      expect(orphan).toEqual([]);
    });
  }
});
