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
 * Uppercases the input and strips anything that isn't [0-9A-Z]. Mirrors the
 * `normalizeBrDocument` helper in br-documents.ts.
 */
function onlyAlnum(value: string | number | null | undefined): string {
  return (value ?? '').toString().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * CPF (11 digits) or CNPJ (14 alphanumeric). The mask is driven by the
 * length of the normalized input:
 *   - ≤ 11 chars: CPF shape "000.000.000-00" (digits only; letters are
 *     tolerated during typing but `isValidCPF` will reject them)
 *   - 12–14 chars: CNPJ shape "00.ABC.000/00DE-00", supporting the new
 *     alphanumeric format (IN RFB 2.229/2024). Positions 13–14 remain
 *     purely numeric (the two check digits) — any letter in those slots
 *     will be stripped on the raw-value side by the form handler.
 */
export function maskBrDocument(value: string | number | null | undefined): string {
  const s = onlyAlnum(value).slice(0, 14);
  if (s.length <= 11) {
    return s
      .replace(/^(\w{3})(\w)/, '$1.$2')
      .replace(/^(\w{3})\.(\w{3})(\w)/, '$1.$2.$3')
      .replace(/(\w{3})(\w{1,2})$/, '$1-$2');
  }
  return s
    .replace(/^(\w{2})(\w)/, '$1.$2')
    .replace(/^(\w{2})\.(\w{3})(\w)/, '$1.$2.$3')
    .replace(/\.(\w{3})(\w)/, '.$1/$2')
    .replace(/(\w{4})(\w)/, '$1-$2');
}
