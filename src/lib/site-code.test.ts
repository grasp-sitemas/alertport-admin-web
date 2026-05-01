import { describe, it, expect } from 'vitest';
import {
  formatSiteCodeForDisplay,
  isValidSiteCode,
  SITE_CODE_DISPLAY_PREFIX,
  SITE_CODE_REGEX,
} from './site-code';

describe('site-code helpers', () => {
  describe('SITE_CODE_REGEX', () => {
    it('accepts 6 chars from the Crockford alphabet', () => {
      expect(SITE_CODE_REGEX.test('A1B2C3')).toBe(true);
      expect(SITE_CODE_REGEX.test('XYZ234')).toBe(true);
      expect(SITE_CODE_REGEX.test('234567')).toBe(true);
    });

    it('rejects forbidden chars (I, L, O, U)', () => {
      expect(SITE_CODE_REGEX.test('A1B2CI')).toBe(false);
      expect(SITE_CODE_REGEX.test('LMNPQR')).toBe(false);
      expect(SITE_CODE_REGEX.test('UV1234')).toBe(false);
      expect(SITE_CODE_REGEX.test('AOK123')).toBe(false);
    });

    it('rejects wrong length and lowercase', () => {
      expect(SITE_CODE_REGEX.test('AB123')).toBe(false);
      expect(SITE_CODE_REGEX.test('AB12345')).toBe(false);
      expect(SITE_CODE_REGEX.test('a1b2c3')).toBe(false);
    });
  });

  describe('isValidSiteCode', () => {
    it('returns true for valid codes', () => {
      expect(isValidSiteCode('A1B2C3')).toBe(true);
    });

    it('returns false for non-strings or invalid shapes', () => {
      expect(isValidSiteCode(null)).toBe(false);
      expect(isValidSiteCode(undefined)).toBe(false);
      expect(isValidSiteCode(123456)).toBe(false);
      expect(isValidSiteCode('AOK123')).toBe(false);
    });
  });

  describe('formatSiteCodeForDisplay', () => {
    it('prepends AP- for valid codes', () => {
      expect(formatSiteCodeForDisplay('A1B2C3')).toBe(`${SITE_CODE_DISPLAY_PREFIX}A1B2C3`);
    });

    it('returns empty string for invalid input', () => {
      expect(formatSiteCodeForDisplay(undefined)).toBe('');
      expect(formatSiteCodeForDisplay(null)).toBe('');
      expect(formatSiteCodeForDisplay('')).toBe('');
      expect(formatSiteCodeForDisplay('a1b2c3')).toBe('');
    });
  });
});
