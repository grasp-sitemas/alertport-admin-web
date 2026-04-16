import { describe, it, expect } from 'vitest';
import { validateLoginUser } from '@/hooks/use-auth';
import type { User } from '@/types/api';

function user(overrides: Partial<User> = {}): User {
  return {
    _id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    status: 'ACTIVE',
    companyUser: { subtype: 'ADMIN', status: 'ACTIVE' },
    ...overrides,
  };
}

describe('validateLoginUser', () => {
  it('allows an active admin user', () => {
    expect(validateLoginUser(user())).toEqual({ valid: true });
  });

  it('rejects archived users', () => {
    const result = validateLoginUser(user({ status: 'ARCHIVED' }));
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe('auth.loginArchivedUser');
  });

  it('allows various admin subtypes', () => {
    expect(validateLoginUser(user({ companyUser: { subtype: 'MANAGER', status: 'ACTIVE' } })).valid).toBe(true);
    expect(validateLoginUser(user({ companyUser: { subtype: 'OPERATOR', status: 'ACTIVE' } })).valid).toBe(true);
    expect(validateLoginUser(user({ companyUser: { subtype: 'AUDITOR', status: 'ACTIVE' } })).valid).toBe(true);
  });
});
