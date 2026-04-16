import type { UserSubtype } from '@/types/api';

export const ADMIN_ALLOWED_SUBTYPES: UserSubtype[] = [
  'SUPER_ADMIN_MASTER',
  'ADMIN_MASTER',
  'ADMIN',
  'MANAGER',
  'OPERATOR',
  'AUDITOR',
];

export const ROLES: { value: UserSubtype; labelKey: string }[] = [
  { value: 'ADMIN', labelKey: 'roles.admin' },
  { value: 'MANAGER', labelKey: 'roles.manager' },
  { value: 'OPERATOR', labelKey: 'roles.operator' },
  { value: 'AUDITOR', labelKey: 'roles.auditor' },
];

export const MANAGEMENT_ROLES: UserSubtype[] = [
  'SUPER_ADMIN_MASTER',
  'ADMIN_MASTER',
  'ADMIN',
  'MANAGER',
];

export const SCHEDULING_ROLES: UserSubtype[] = [
  'SUPER_ADMIN_MASTER',
  'ADMIN',
  'MANAGER',
];

export const MONITOR_ROLES: UserSubtype[] = [
  'SUPER_ADMIN_MASTER',
  'ADMIN',
  'MANAGER',
  'OPERATOR',
];

export function isSuperAdminMaster(subtype?: UserSubtype): boolean {
  return subtype === 'SUPER_ADMIN_MASTER';
}

export function isAdminOrAbove(subtype?: UserSubtype): boolean {
  return ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN'].includes(subtype || '');
}

export function isManagerOrAbove(subtype?: UserSubtype): boolean {
  return ['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(subtype || '');
}

export function isAllowedAdminUser(subtype?: UserSubtype): boolean {
  return ADMIN_ALLOWED_SUBTYPES.includes(subtype as UserSubtype);
}

export function isMasterEmailAllowed(email?: string): boolean {
  const allowedEmails = process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAILS || '';
  if (!allowedEmails) return true;
  return allowedEmails.split(',').map((e) => e.trim().toLowerCase()).includes((email || '').toLowerCase());
}

export function canAccessRoute(subtype: UserSubtype | undefined, requiredRoles: UserSubtype[]): boolean {
  if (!subtype) return false;
  return requiredRoles.includes(subtype);
}
