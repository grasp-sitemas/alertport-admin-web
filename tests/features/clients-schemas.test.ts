import { describe, it, expect } from 'vitest';
import { clientFormSchema } from '@/features/clients/schemas';
import { siteFormSchema } from '@/features/sites/schemas';

describe('clientFormSchema', () => {
  it('accepts a minimal valid client', () => {
    const parsed = clientFormSchema.safeParse({
      name: 'Acme',
      type: 'CLIENT',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(true);
  });

  it('requires name', () => {
    const parsed = clientFormSchema.safeParse({
      name: '',
      type: 'CLIENT',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const parsed = clientFormSchema.safeParse({
      name: 'Acme',
      email: 'not-an-email',
      type: 'CLIENT',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(false);
  });

  it('enforces type literal', () => {
    const parsed = clientFormSchema.safeParse({
      name: 'Acme',
      type: 'SITE', // wrong literal
      status: 'ACTIVE',
    });
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
