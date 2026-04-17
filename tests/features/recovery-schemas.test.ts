import { describe, it, expect } from 'vitest';
import {
  recoveryEmailSchema,
  recoveryResetSchema,
} from '@/features/auth/schemas';

describe('recoveryEmailSchema', () => {
  it('accepts a valid email', () => {
    expect(recoveryEmailSchema.safeParse({ email: 'alice@example.com' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(recoveryEmailSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects an empty email', () => {
    expect(recoveryEmailSchema.safeParse({ email: '' }).success).toBe(false);
  });
});

describe('recoveryResetSchema', () => {
  it('accepts an 8-char code with matching passwords', () => {
    const parsed = recoveryResetSchema.safeParse({
      code: 'ABCD1234',
      password: 'Secret-8',
      passwordConfirm: 'Secret-8',
    });
    expect(parsed.success).toBe(true);
    // code is transformed to uppercase by the schema
    if (parsed.success) {
      expect(parsed.data.code).toBe('ABCD1234');
    }
  });

  it('uppercases lowercase code input', () => {
    const parsed = recoveryResetSchema.safeParse({
      code: 'abcd1234',
      password: 'Secret-8',
      passwordConfirm: 'Secret-8',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe('ABCD1234');
    }
  });

  it('rejects a code shorter than 8 characters', () => {
    const parsed = recoveryResetSchema.safeParse({
      code: 'ABCD',
      password: 'Secret-8',
      passwordConfirm: 'Secret-8',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a password shorter than 6 characters', () => {
    const parsed = recoveryResetSchema.safeParse({
      code: 'ABCD1234',
      password: '123',
      passwordConfirm: '123',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const parsed = recoveryResetSchema.safeParse({
      code: 'ABCD1234',
      password: 'Secret-8',
      passwordConfirm: 'secret-2',
    });
    expect(parsed.success).toBe(false);
  });
});
