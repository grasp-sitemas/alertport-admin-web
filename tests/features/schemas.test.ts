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
  it('accepts a valid ADMIN user without client/site', () => {
    const parsed = userFormSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      email: 'a@b.com',
      status: 'ACTIVE',
      companyUser: { subtype: 'ADMIN', status: 'ACTIVE' },
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a valid OPERATOR user WITH client', () => {
    const parsed = userFormSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      email: 'a@b.com',
      client: 'cli-1',
      status: 'ACTIVE',
      companyUser: { subtype: 'OPERATOR', status: 'ACTIVE' },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects OPERATOR / MANAGER / AUDITOR without client', () => {
    const base = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'a@b.com',
      status: 'ACTIVE' as const,
    };
    for (const subtype of ['OPERATOR', 'MANAGER', 'AUDITOR'] as const) {
      const parsed = userFormSchema.safeParse({
        ...base,
        companyUser: { subtype, status: 'ACTIVE' },
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects mismatched passwords', () => {
    const parsed = userFormSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      email: 'a@b.com',
      client: 'cli-1',
      password: 'a',
      confirmPassword: 'b',
      status: 'ACTIVE',
      companyUser: { subtype: 'OPERATOR', status: 'ACTIVE' },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('equipmentFormSchema', () => {
  it('accepts a valid equipment with hierarchy', () => {
    const parsed = equipmentFormSchema.safeParse({
      account: 'acc1',
      client: 'cli1',
      site: 'site1',
      code: 'RADIO-001',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(true);
  });

  it('requires code', () => {
    const parsed = equipmentFormSchema.safeParse({
      account: 'acc1',
      client: 'cli1',
      site: 'site1',
      code: '',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(false);
  });

  it('requires account/client/site', () => {
    const parsed = equipmentFormSchema.safeParse({
      account: '',
      client: '',
      site: '',
      code: 'A',
      status: 'ACTIVE',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('alertScheduleSchema', () => {
  it('validates a fixed interval schedule', () => {
    const parsed = alertScheduleSchema.safeParse({
      name: 'Morning check',
      client: 'cli1',
      site: 'site1',
      equipment: 'eq1',
      frequency: 'DAILY',
      category: 'ALERT_CHECK',
      beginDate: '2026-01-01',
      endDate: '2026-12-31',
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
      client: 'cli1',
      site: 'site1',
      equipment: 'eq1',
      frequency: 'DAILY',
      category: 'ALERT_CHECK',
      beginDate: '2026-01-01',
      endDate: '2026-12-31',
      beginHour: '08:00',
      endHour: '12:00',
      status: 'ACTIVE',
      alertConfig: { alertType: 'RANDOM' },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects schedule without equipment/client/site', () => {
    const parsed = alertScheduleSchema.safeParse({
      name: 'Morning check',
      client: '',
      site: '',
      equipment: '',
      frequency: 'DAILY',
      category: 'ALERT_CHECK',
      beginDate: '2026-01-01',
      endDate: '2026-12-31',
      beginHour: '08:00',
      endHour: '12:00',
      status: 'ACTIVE',
      alertConfig: { alertType: 'FIXED', fixedInterval: 30 },
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects schedules where endDate is before beginDate', () => {
    const parsed = alertScheduleSchema.safeParse({
      name: 'Morning check',
      client: 'cli1',
      site: 'site1',
      equipment: 'eq1',
      frequency: 'DAILY',
      category: 'ALERT_CHECK',
      beginDate: '2026-04-27',
      endDate: '2026-04-26',
      beginHour: '08:00',
      endHour: '12:00',
      status: 'ACTIVE',
      alertConfig: { alertType: 'FIXED', fixedInterval: 30, volumeLevel: 80 },
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.endDate).toContain(
        'A data final deve ser igual ou posterior à data inicial',
      );
    }
  });
});
