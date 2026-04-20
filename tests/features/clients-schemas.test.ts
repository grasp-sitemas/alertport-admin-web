import { describe, it, expect } from 'vitest';
import { clientFormSchema } from '@/features/clients/schemas';
import { siteFormSchema } from '@/features/sites/schemas';

describe('clientFormSchema', () => {
  // `account` is a required ObjectId ref - clients must belong to an account.
  // Tests here pass a placeholder id so the positive assertions actually
  // reach the rule under test instead of dying on account validation.
  const baseValid = {
    name: 'Acme',
    type: 'CLIENT' as const,
    status: 'ACTIVE' as const,
    account: 'account-id-1',
    primaryPhone: '',
    owner: '',
  };

  it('accepts a minimal valid client', () => {
    const parsed = clientFormSchema.safeParse(baseValid);
    expect(parsed.success).toBe(true);
  });

  it('requires name', () => {
    const parsed = clientFormSchema.safeParse({ ...baseValid, name: '' });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const parsed = clientFormSchema.safeParse({ ...baseValid, email: 'not-an-email' });
    expect(parsed.success).toBe(false);
  });

  it('enforces type literal', () => {
    const parsed = clientFormSchema.safeParse({ ...baseValid, type: 'SITE' as never });
    expect(parsed.success).toBe(false);
  });

  it('rejects missing account', () => {
    const parsed = clientFormSchema.safeParse({ ...baseValid, account: '' });
    expect(parsed.success).toBe(false);
  });
});

describe('siteFormSchema', () => {
  it('accepts a valid site with client', () => {
    const parsed = siteFormSchema.safeParse({
      name: 'Posto Central',
      client: 'client-id-123',
      address: { country: 'BR', name: 'MAIN' },
      type: 'SITE',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(true);
  });

  it('requires client', () => {
    const parsed = siteFormSchema.safeParse({
      name: 'Posto Central',
      client: '',
      address: {},
      type: 'SITE',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(false);
  });

  it('requires name', () => {
    const parsed = siteFormSchema.safeParse({
      name: '',
      client: 'c1',
      address: {},
      type: 'SITE',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(false);
  });
});
