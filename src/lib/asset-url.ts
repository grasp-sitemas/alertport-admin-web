import { env } from '@/config/env';

/**
 * Resolves a stored photo/logo URL into a fully-qualified URL the browser can
 * load. The legacy backend persists uploads as relative paths like
 * `/filemanager/photo/<name>.png` — absent a prefix, the browser requests them
 * against the Vercel origin (404) instead of the API gateway that actually
 * serves them.
 *
 * Rules:
 *   - absolute URL (http/https/data/blob): returned unchanged
 *   - empty / placeholder ("https://"): returns empty string
 *   - relative path: prefixed with `env.apiUrl`
 */
export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'https://') return '';
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  const base = (env.apiUrl || '').replace(/\/$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}
