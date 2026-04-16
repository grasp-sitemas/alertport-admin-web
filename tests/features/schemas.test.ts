import { describe, it, expect } from 'vitest';
import { loginSchema } from '@/features/auth/schemas';
import { userFormSchema } from '@/features/users/schemas';
import { equipmentFormSchema } from '@/features/equipment/schemas';
import { alertScheduleSchema } from '@/features/alerts/schemas';

describe('loginSchema', () => {
  it('accepts valid input', () => {
    const parsed = loginSchema.safeParse({ email: 'a@b.com', password: '1234' });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const parsed = loginSchema.safeParse({ email: 'not-an-email', password: '1234' });
    expect(parsed.success).toBe(false);
  });

  it('requires password', () => {
    const parsed = loginSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(parsed.success).toBe(false);
  });
});

describe('userFormSchema', () => {
  it('accepts a valid user', () => {
    const parsed = userFormSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      email: 'a@b.com',
      status: 'ACTIVE',
      companyUser: { subtype: 'OPERATOR', status: 'ACTIVE' },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const parsed = userFormSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      email: 'a@b.com',
      password: 'a',
      confirmPassword: 'b',
      status: 'ACTIVE',
      companyUser: { subtype: 'OPERATOR', status: 'ACTIVE' },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('equipmentFormSchema', () => {
  it('accepts minimal equipment', () => {
    const parsed = equipmentFormSchema.safeParse({ name: 'Radio', status: 'ACTIVE' });
    expect(parsed.success).toBe(true);
  });

  it('requires name', () => {
    const parsed = equipmentFormSchema.safeParse({ name: '', status: 'ACTIVE' });
    expect(parsed.success).toBe(false);
  });
});

describe('alertScheduleSchema', () => {
  it('validates a fixed interval schedule', () => {
    const parsed = alertScheduleSchema.safeParse({
      name: 'Morning check',
      frequency: 'DAILY',
      category: 'ALERT_CHECK',
      beginDate: '2026-01-01',
      beginHour: '08:00',
      endHour: '12:00',
      status: 'ACTIVE',
      alertConfig: { alertType: 'FIXED', fixedInterval: 30, volumeLevel: 80 },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a random schedule without min/max', () => {
    const parsed = alertScheduleSchema.safeParse({
      name: 'Random',
      frequency: 'DAILY',
      category: 'ALERT_CHECK',
      beginDate: '2026-01-01',
      beginHour: '08:00',
      endHour: '12:00',
      status: 'ACTIVE',
      alertConfig: { alertType: 'RANDOM' },
    });
    expect(parsed.success).toBe(false);
  });
});
