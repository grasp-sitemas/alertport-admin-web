import { describe, it, expect } from 'vitest';
import {
  ADMIN_TOUR_STEPS,
  OPERATOR_TOUR_STEPS,
  getTourSteps,
  pickTourForRole,
} from '@/features/onboarding/tours';
import ptMessages from '@/messages/pt.json';

// Rails around the onboarding content so it stays in sync with the
// product spec: admin learns clients -> sites -> QR code -> device
// linking; operator learns the monitor + SOS + attendance + calls loop.

describe('pickTourForRole', () => {
  it('routes OPERATOR to the operator tour', () => {
    expect(pickTourForRole('OPERATOR')).toBe('operator');
  });
  it('routes ADMIN family to the admin tour', () => {
    expect(pickTourForRole('ADMIN')).toBe('admin');
    expect(pickTourForRole('ADMIN_MASTER')).toBe('admin');
    expect(pickTourForRole('SUPER_ADMIN_MASTER')).toBe('admin');
  });
  it('returns null for MANAGER / AUDITOR / unknown / empty', () => {
    expect(pickTourForRole('MANAGER')).toBeNull();
    expect(pickTourForRole('AUDITOR')).toBeNull();
    expect(pickTourForRole('VIGILANT')).toBeNull();
    expect(pickTourForRole(undefined)).toBeNull();
    expect(pickTourForRole('')).toBeNull();
  });
});

describe('tour steps structure', () => {
  it('admin tour has meaningful length (>= 10 steps)', () => {
    expect(ADMIN_TOUR_STEPS.length).toBeGreaterThanOrEqual(10);
  });
  it('operator tour has meaningful length (>= 10 steps)', () => {
    expect(OPERATOR_TOUR_STEPS.length).toBeGreaterThanOrEqual(10);
  });

  it('getTourSteps returns the right array for each tour', () => {
    expect(getTourSteps('admin')).toBe(ADMIN_TOUR_STEPS);
    expect(getTourSteps('operator')).toBe(OPERATOR_TOUR_STEPS);
  });

  it('every step has a non-empty target and title/content keys', () => {
    for (const step of [...ADMIN_TOUR_STEPS, ...OPERATOR_TOUR_STEPS]) {
      expect(step.target).toBeTruthy();
      expect(step.titleKey).toMatch(/^onboarding\./);
      expect(step.contentKey).toMatch(/^onboarding\./);
    }
  });
});

describe('i18n coverage of tour keys', () => {
  function resolveKey(path: string): unknown {
    const parts = path.split('.');
    let node: unknown = ptMessages;
    for (const p of parts) {
      if (!node || typeof node !== 'object') return undefined;
      node = (node as Record<string, unknown>)[p];
    }
    return node;
  }

  it('every titleKey/contentKey resolves in pt.json', () => {
    const missing: string[] = [];
    for (const step of [...ADMIN_TOUR_STEPS, ...OPERATOR_TOUR_STEPS]) {
      const title = resolveKey(step.titleKey);
      const content = resolveKey(step.contentKey);
      if (typeof title !== 'string' || !title.trim()) missing.push(step.titleKey);
      if (typeof content !== 'string' || !content.trim()) missing.push(step.contentKey);
    }
    expect(missing).toEqual([]);
  });

  it('admin tour covers the product-spec journey (clients, sites, QR, scheduling, reports)', () => {
    const titles = ADMIN_TOUR_STEPS.map((s) => resolveKey(s.titleKey) as string);
    // Product owner insisted ADMIN must discover: clients, sites, QR
    // code scan, device linking, schedule, attendance, reports.
    expect(titles.join(' ')).toMatch(/Cliente/i);
    expect(titles.join(' ')).toMatch(/Posto/i);
    expect(titles.join(' ')).toMatch(/QR/i);
    expect(titles.join(' ')).toMatch(/Agendamento/i);
    expect(titles.join(' ')).toMatch(/Presen[çc]a/i);
    expect(titles.join(' ')).toMatch(/Relat[óo]rios/i);
  });

  it('operator tour covers SOS + attendance + calls + recording + KPIs', () => {
    const titles = OPERATOR_TOUR_STEPS.map((s) => resolveKey(s.titleKey) as string);
    expect(titles.join(' ')).toMatch(/SOS/i);
    expect(titles.join(' ')).toMatch(/atend/i);
    expect(titles.join(' ')).toMatch(/liga[çc][ãa]o|escuta/i);
    expect(titles.join(' ')).toMatch(/grava[çc][ãa]o/i);
    expect(titles.join(' ')).toMatch(/indicador|KPI/i);
  });
});
