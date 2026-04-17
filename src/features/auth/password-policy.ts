/**
 * Central password policy for self-signup.
 *
 * Rules (balanced, not annoying):
 *  1. At least 8 characters
 *  2. At least one uppercase letter
 *  3. At least one special character
 *  4. No 3+ sequential digits (e.g. 123, 345, 987)
 *
 * `evaluate()` returns the status of each rule so the UI can render a live
 * checklist. `passesAll()` is a single-boolean gate used by zod / the form
 * submit button.
 */

export type PasswordRuleKey = 'minLength' | 'uppercase' | 'special' | 'noSequentialDigits';

export interface PasswordRuleResult {
  key: PasswordRuleKey;
  labelKey: string; // i18n key for UI
  passed: boolean;
}

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/;
const UPPERCASE_REGEX = /[A-Z]/;
const MIN_LENGTH = 8;

/** Returns true if the string contains 3+ consecutive ascending/descending digits. */
export function hasSequentialDigits(s: string): boolean {
  if (!s) return false;
  for (let i = 0; i < s.length - 2; i++) {
    const a = s.charCodeAt(i);
    const b = s.charCodeAt(i + 1);
    const c = s.charCodeAt(i + 2);
    const isDigit = (ch: number) => ch >= 48 && ch <= 57; // 0-9
    if (isDigit(a) && isDigit(b) && isDigit(c)) {
      if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) {
        return true;
      }
    }
  }
  return false;
}

export function evaluatePassword(password: string): PasswordRuleResult[] {
  const value = password ?? '';
  return [
    {
      key: 'minLength',
      labelKey: 'signup.password.rules.minLength',
      passed: value.length >= MIN_LENGTH,
    },
    {
      key: 'uppercase',
      labelKey: 'signup.password.rules.uppercase',
      passed: UPPERCASE_REGEX.test(value),
    },
    {
      key: 'special',
      labelKey: 'signup.password.rules.special',
      passed: SPECIAL_CHAR_REGEX.test(value),
    },
    {
      key: 'noSequentialDigits',
      labelKey: 'signup.password.rules.noSequentialDigits',
      passed: value.length > 0 && !hasSequentialDigits(value),
    },
  ];
}

export function passesPasswordPolicy(password: string): boolean {
  return evaluatePassword(password).every((r) => r.passed);
}
