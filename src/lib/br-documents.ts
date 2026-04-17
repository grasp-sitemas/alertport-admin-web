/**
 * Brazilian document validators — CPF (11 digits) and CNPJ (14 digits).
 *
 * Both implementations follow the official checksum algorithm from Receita
 * Federal. Every "rejected" shape (wrong length, all equal digits, failing
 * check digit) returns `false`. Anything else that isn't obviously either is
 * delegated to the caller — `validateBrDocument` is the entry-point to use
 * from forms / zod refinements.
 */

function onlyDigits(v: string): string {
  return (v ?? '').toString().replace(/\D/g, '');
}

function allEqual(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (allEqual(cpf)) return false;

  const calcDigit = (slice: string) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * (slice.length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9));
  if (d1 !== Number(cpf[9])) return false;
  const d2 = calcDigit(cpf.slice(0, 10));
  if (d2 !== Number(cpf[10])) return false;

  return true;
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (allEqual(cnpj)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calc = (slice: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(cnpj.slice(0, 12), weights1);
  if (d1 !== Number(cnpj[12])) return false;
  const d2 = calc(cnpj.slice(0, 13), weights2);
  if (d2 !== Number(cnpj[13])) return false;

  return true;
}

/**
 * Validates a Brazilian fiscal document — dispatches to CPF (11 digits) or
 * CNPJ (14 digits) based on the digit count. Any other length is rejected.
 */
export function isValidBrDocument(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}
