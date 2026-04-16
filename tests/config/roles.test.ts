import { describe, it, expect } from 'vitest';
import {
  isSuperAdminMaster,
  isAdminOrAbove,
  isManagerOrAbove,
  isAllowedAdminUser,
  canAccessRoute,
} from '@/config/roles';

describe('Role helpers', () => {
  it('detects super admin master', () => {
    expect(isSuperAdminMaster('SUPER_ADMIN_MASTER')).toBe(true);
    expect(isSuperAdminMaster('ADMIN')).toBe(false);
  });

  it('detects admin or above', () => {
    expect(isAdminOrAbove('ADMIN')).toBe(true);
    expect(isAdminOrAbove('SUPER_ADMIN_MASTER')).toBe(true);
    expect(isAdminOrAbove('MANAGER')).toBe(false);
  });

  it('detects manager or above', () => {
    expect(isManagerOrAbove('MANAGER')).toBe(true);
    expect(isManagerOrAbove('OPERATOR')).toBe(false);
  });

  it('allows valid admin subtypes', () => {
    expect(isAllowedAdminUser('ADMIN')).toBe(true);
    expect(isAllowedAdminUser('OPERATOR')).toBe(true);
    expect(isAllowedAdminUser(undefined)).toBe(false);
  });

  it('canAccessRoute respects role list', () => {
    expect(canAccessRoute('ADMIN', ['ADMIN', 'MANAGER'])).toBe(true);
    expect(canAccessRoute('OPERATOR', ['ADMIN'])).toBe(false);
    expect(canAccessRoute(undefined, ['ADMIN'])).toBe(false);
  });
});
