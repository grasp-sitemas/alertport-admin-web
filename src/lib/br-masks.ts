/**
 * Lightweight, dependency-free masks for Brazilian inputs. Each function takes
 * any value (string | number | null), strips non-digits, truncates to the max
 * length for the format, and returns a display-formatted string.
 *
 * The paired Zod schemas persist only the raw digits, so the mask is purely a
 * UI concern. `onlyDigits` is exposed for symmetry with form setValue()
 * handlers that want to keep storage clean.
 */

export function onlyDigits(value: string | number | null | undefined): string {
  return (value ?? '').toString().replace(/\D/g, '');
}

/**
 * Brazilian phone — fixed (10 digits) or mobile (11 digits).
 *   "11987654321" → "(11) 98765-4321"
 *   "1134567890"  → "(11) 3456-7890"
 */
export function maskPhoneBR(value: string | number | null | undefined): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    // Landline: (XX) XXXX-XXXX
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  // Mobile: (XX) XXXXX-XXXX
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * CPF (11) / CNPJ (14). Shape is detected from the digit length.
 */
export function maskBrDocument(value: string | number | null | undefined): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
