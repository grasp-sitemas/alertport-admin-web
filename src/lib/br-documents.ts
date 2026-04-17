/**
 * Brazilian fiscal-document validators — CPF (11 numeric digits) and the new
 * CNPJ Alfanumérico introduced by Receita Federal in Instrução Normativa RFB
 * nº 2.229/2024. The alphanumeric format takes effect in July 2026; existing
 * numeric CNPJs remain valid forever and pass this same algorithm unchanged.
 *
 * Canonical spec:
 *   - 14 positions total.
 *   - Positions 1–12 may contain digits OR uppercase letters A–Z.
 *   - Positions 13–14 MUST remain purely numeric (the two check digits).
 *   - Each character is converted to a numeric value by (charCode - 48), so
 *     '0'..'9' → 0..9 and 'A'..'Z' → 17..42 (matches the published example
 *     A=17, B=18, C=19).
 *   - Check digits are computed with modulo 11 using the legacy weights:
 *       d1 weights = [5,4,3,2,9,8,7,6,5,4,3,2]
 *       d2 weights = [6,5,4,3,2,9,8,7,6,5,4,3,2]
 *     A modulo result < 2 produces digit 0; otherwise digit = 11 − result.
 *
 * CPF keeps its digits-only rule (11 numeric characters).
 *
 * Every rejected shape (wrong length, all-equal chars, failing check digit,
 * non-alphanumeric character in CNPJ, letters in CPF or in the last two
 * positions of CNPJ) returns `false`. Input is normalized (uppercased, any
 * separator removed) before evaluation.
 */

/**
 * Uppercases `value`, drops everything that isn't [0-9A-Z]. Safe for mask
 * input (accepts the formatted "12.345.678/0001-81" or "12.ABC.345/01DE-35").
 */
export function normalizeBrDocument(value: string | null | undefined): string {
  return (value ?? '').toString().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function allEqualChars(input: string): boolean {
  return input.length > 0 && /^(.)\1+$/.test(input);
}

/**
 * Official Receita Federal conversion: ASCII value minus 48.
 *   '0' (48) → 0 ... '9' (57) → 9
 *   'A' (65) → 17 ... 'Z' (90) → 42
 */
function charToValue(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

export function isValidCPF(value: string | null | undefined): boolean {
  const cpf = normalizeBrDocument(value);
  if (cpf.length !== 11) return false;
  // CPF must be purely digits — any letter invalidates it.
  if (!/^\d{11}$/.test(cpf)) return false;
  if (allEqualChars(cpf)) return false;

  const calc = (slice: string) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * (slice.length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  if (calc(cpf.slice(0, 9)) !== Number(cpf[9])) return false;
  if (calc(cpf.slice(0, 10)) !== Number(cpf[10])) return false;
  return true;
}

const CNPJ_WEIGHTS_D1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_D2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Validates both legacy numeric CNPJ and the new alphanumeric CNPJ
 * (IN RFB 2.229/2024, effective July 2026).
 */
export function isValidCNPJ(value: string | null | undefined): boolean {
  const cnpj = normalizeBrDocument(value);
  if (cnpj.length !== 14) return false;

  // Positions 1–12 must be alphanumeric; positions 13–14 MUST be digits
  // (the two check digits).
  if (!/^[0-9A-Z]{12}$/.test(cnpj.slice(0, 12))) return false;
  if (!/^\d{2}$/.test(cnpj.slice(12))) return false;

  // Reject obviously synthetic values (AAAAAAAAAAAAAA, 00000000000000, …).
  if (allEqualChars(cnpj)) return false;

  const calc = (slice: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += charToValue(slice[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(cnpj.slice(0, 12), CNPJ_WEIGHTS_D1);
  if (d1 !== Number(cnpj[12])) return false;
  const d2 = calc(cnpj.slice(0, 13), CNPJ_WEIGHTS_D2);
  if (d2 !== Number(cnpj[13])) return false;

  return true;
}

/**
 * Entry-point for forms / zod refinements: dispatches to CPF (length 11) or
 * CNPJ (length 14). Any other shape is rejected.
 */
export function isValidBrDocument(value: string | null | undefined): boolean {
  const norm = normalizeBrDocument(value);
  if (norm.length === 11) return isValidCPF(norm);
  if (norm.length === 14) return isValidCNPJ(norm);
  return false;
}

export type BrDocumentKind = 'CPF' | 'CNPJ' | null;

/**
 * Classifies a document by its normalized length. Returns null if the shape
 * doesn't match either format. Useful when the UI wants to display a
 * CPF/CNPJ-specific label next to a single input.
 */
export function classifyBrDocument(value: string | null | undefined): BrDocumentKind {
  const norm = normalizeBrDocument(value);
  if (norm.length === 11) return 'CPF';
  if (norm.length === 14) return 'CNPJ';
  return null;
}
