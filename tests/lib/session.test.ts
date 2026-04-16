import { describe, it, expect, beforeEach } from 'vitest';
import {
  setSession,
  getSession,
  clearSession,
  getSessionUser,
  getSessionToken,
  isSessionValid,
  updateSessionUser,
} from '@/lib/session';
import type { User } from '@/types/api';

const MOCK_USER: User = {
  _id: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  status: 'ACTIVE',
  companyUser: { subtype: 'ADMIN', status: 'ACTIVE' },
};

describe('session', () => {
  beforeEach(() => {
    clearSession();
  });

  it('persists and retrieves session data', () => {
    setSession({ token: 'abc', user: MOCK_USER, language: 'pt' });
    const session = getSession();
    expect(session?.token).toBe('abc');
    expect(session?.user.email).toBe('john@example.com');
  });

  it('isSessionValid reflects session state', () => {
    expect(isSessionValid()).toBe(false);
    setSession({ token: 'abc', user: MOCK_USER, language: 'pt' });
    expect(isSessionValid()).toBe(true);
    clearSession();
    expect(isSessionValid()).toBe(false);
  });

  it('getSessionUser returns the stored user', () => {
    setSession({ token: 'abc', user: MOCK_USER, language: 'pt' });
    expect(getSessionUser()?.firstName).toBe('John');
  });

  it('getSessionToken returns the stored token', () => {
    setSession({ token: 'abc', user: MOCK_USER, language: 'pt' });
    expect(getSessionToken()).toBe('abc');
  });

  it('updateSessionUser merges fields', () => {
    setSession({ token: 'abc', user: MOCK_USER, language: 'pt' });
    updateSessionUser({ firstName: 'Jane' });
    expect(getSessionUser()?.firstName).toBe('Jane');
    expect(getSessionUser()?.lastName).toBe('Doe');
  });
});
