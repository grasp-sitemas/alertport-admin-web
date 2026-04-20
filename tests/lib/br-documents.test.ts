import { describe, it, expect } from 'vitest';
import {
  isValidCPF,
  isValidCNPJ,
  isValidBrDocument,
  normalizeBrDocument,
  classifyBrDocument,
} from '@/lib/br-documents';

describe('normalizeBrDocument', () => {
  it('uppercases and strips non-alphanumeric', () => {
    expect(normalizeBrDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(normalizeBrDocument(' 123.456.789-09 ')).toBe('12345678909');
  });
  it('handles null / undefined / number input', () => {
    expect(normalizeBrDocument(null)).toBe('');
    expect(normalizeBrDocument(undefined)).toBe('');
    // numbers ok too
    expect(normalizeBrDocument(12345 as unknown as string)).toBe('12345');
  });
});

describe('isValidCPF - numeric only (11 digits)', () => {
  it('accepts canonical valid CPFs', () => {
    // Public test vectors commonly used for CPF examples.
    expect(isValidCPF('123.456.789-09')).toBe(true);
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });
  it('rejects wrong check digits', () => {
    expect(isValidCPF('123.456.789-00')).toBe(false);
    expect(isValidCPF('529.982.247-24')).toBe(false);
  });
  it('rejects all-equal digits', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('000.000.000-00')).toBe(false);
  });
  it('rejects letters in CPF', () => {
    expect(isValidCPF('12345678A09')).toBe(false);
  });
  it('rejects wrong length', () => {
    expect(isValidCPF('1234567890')).toBe(false); // 10
    expect(isValidCPF('123456789012')).toBe(false); // 12
    expect(isValidCPF('')).toBe(false);
  });
});

describe('isValidCNPJ - legacy numeric (14 digits)', () => {
  it('accepts canonical valid numeric CNPJs', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('45.723.174/0001-10')).toBe(true);
  });
  it('rejects wrong check digits', () => {
    expect(isValidCNPJ('11.222.333/0001-82')).toBe(false);
    expect(isValidCNPJ('12.345.678/0001-90')).toBe(false);
  });
  it('rejects all-equal chars', () => {
    expect(isValidCNPJ('00.000.000/0000-00')).toBe(false);
    expect(isValidCNPJ('99999999999999')).toBe(false);
  });
});

describe('isValidCNPJ - alphanumeric (IN RFB 2.229/2024)', () => {
  /**
   * Test vector computed by hand with the official algorithm:
   *   raw positions 1–12 = "12ABC34501DE"
   *   char-to-value     = [1, 2, 17, 18, 19, 3, 4, 5, 0, 1, 20, 21]
   *   d1 with weights [5,4,3,2,9,8,7,6,5,4,3,2] → sum 459, 459 % 11 = 8, d1 = 3
   *   d2 with weights [6,5,4,3,2,9,8,7,6,5,4,3,2] over 13 chars
   *                    sum 424, 424 % 11 = 6, d2 = 5
   *   Full valid CNPJ = "12ABC34501DE35"
   */
  it('accepts a known-valid alphanumeric CNPJ', () => {
    expect(isValidCNPJ('12ABC34501DE35')).toBe(true);
    // formatted with the same separators a CNPJ uses should still work
    expect(isValidCNPJ('12.ABC.345/01DE-35')).toBe(true);
    // lowercase input gets normalized to uppercase before validation
    expect(isValidCNPJ('12abc34501de35')).toBe(true);
  });
  it('rejects alphanumeric CNPJ with wrong d2', () => {
    expect(isValidCNPJ('12ABC34501DE34')).toBe(false);
    expect(isValidCNPJ('12ABC34501DE30')).toBe(false);
  });
  it('rejects alphanumeric CNPJ with wrong d1', () => {
    expect(isValidCNPJ('12ABC34501DE05')).toBe(false);
  });
  it('rejects when positions 13–14 are not purely numeric', () => {
    expect(isValidCNPJ('12ABC34501DE3A')).toBe(false);
    expect(isValidCNPJ('12ABC34501DEA5')).toBe(false);
  });
  it('rejects when positions 1–12 have non-alphanumeric characters', () => {
    // After normalization separators are stripped so this shouldn't happen
    // in practice, but an explicit character like ç / unicode should fail.
    expect(isValidCNPJ('12ÇBC34501DE35')).toBe(false);
  });
});

describe('isValidBrDocument (dispatcher)', () => {
  it('dispatches by length', () => {
    expect(isValidBrDocument('123.456.789-09')).toBe(true);
    expect(isValidBrDocument('11.222.333/0001-81')).toBe(true);
    expect(isValidBrDocument('12ABC34501DE35')).toBe(true);
    expect(isValidBrDocument('bogus')).toBe(false);
    expect(isValidBrDocument('')).toBe(false);
  });
});

describe('classifyBrDocument', () => {
  it('returns CPF / CNPJ / null based on normalized length', () => {
    expect(classifyBrDocument('12345678909')).toBe('CPF');
    expect(classifyBrDocument('12ABC34501DE35')).toBe('CNPJ');
    expect(classifyBrDocument('short')).toBe(null);
  });
});
