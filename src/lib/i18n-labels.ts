type TranslatorFn = ((key: string) => string) & { has?: (key: string) => boolean };

const API_I18N_PREFIXES = ['str.', 'helpers.', 'response.', 'validation.'];

function isApiI18nKey(value: string): boolean {
  return API_I18N_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function humanizeToken(token: string): string {
  const normalized = token.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return '—';
  return normalized
    .split(/\s+/)
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ');
}

function fallbackFromKey(key: string): string {
  const parts = key.split('.');
  return humanizeToken(parts[parts.length - 1] ?? key);
}

export function translateDynamicLabel(
  value: unknown,
  t?: TranslatorFn,
  fallback = '—',
): string {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim();
  if (!raw) return fallback;

  if (t && typeof t.has === 'function' && t.has(raw)) {
    return t(raw);
  }

  if (isApiI18nKey(raw)) {
    if (t) {
      try {
        const translated = t(raw);
        if (translated && translated !== raw) return translated;
      } catch {
        // ignore and fallback
      }
    }
    return fallbackFromKey(raw);
  }

  return raw;
}
