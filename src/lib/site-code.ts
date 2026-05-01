// Helpers for the human-readable site identifier (siteCode).
// Server is the source of truth — these utilities are display-only.
// Storage form: 6 chars Crockford base32 (no I/L/O/U), uppercase.
// Display form: "AP-XXXXXX".

export const SITE_CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{6}$/;
export const SITE_CODE_DISPLAY_PREFIX = 'AP-';

export function isValidSiteCode(value: unknown): value is string {
  return typeof value === 'string' && SITE_CODE_REGEX.test(value);
}

export function formatSiteCodeForDisplay(code?: string | null): string {
  if (!code || !isValidSiteCode(code)) return '';
  return `${SITE_CODE_DISPLAY_PREFIX}${code}`;
}

export async function copySiteCodeToClipboard(code?: string | null): Promise<boolean> {
  const display = formatSiteCodeForDisplay(code);
  if (!display) return false;
  try {
    await navigator.clipboard.writeText(display);
    return true;
  } catch {
    return false;
  }
}
