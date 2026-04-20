import { describe, it, expect } from 'vitest';
import {
  ADMIN_TOUR_STEPS,
  OPERATOR_TOUR_STEPS,
  getTourSteps,
  pickTourForRole,
} from '@/features/onboarding/tours';
import ptMessages from '@/messages/pt.json';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import jaMessages from '@/messages/ja.json';
import zhMessages from '@/messages/zh.json';

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

describe('role isolation: OPERATOR tour must not leak admin-only surfaces', () => {
  // These anchors belong to screens OPERATOR has no access to
  // per navigation.ts roles. Catching them here prevents a
  // future refactor from silently exposing ADMIN UX to operators.
  const ADMIN_ONLY_ANCHORS = [
    'sidebar-clients',
    'sidebar-sites',
    'sidebar-equipment',
    'sidebar-collaborators',
    'sidebar-users',
    'sidebar-alertScheduling',
    'sidebar-companySettings',
    'sidebar-plan',
    'sidebar-reportAdherence',
    'sidebar-reportSla',
    'page-clients-create',
    'page-sites-create',
    'page-equipment-create',
    'scheduling-calendar',
    'dashboard-kpis',
  ];

  it('OPERATOR steps never target ADMIN-only anchors', () => {
    const leaks: string[] = [];
    for (const step of OPERATOR_TOUR_STEPS) {
      for (const anchor of ADMIN_ONLY_ANCHORS) {
        if (step.target.includes(anchor)) leaks.push(`${step.titleKey} -> ${anchor}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('OPERATOR steps only route to pages the operator can access', () => {
    const operatorRoutes = new Set([
      '/dashboard',
      '/alerts/monitor',
      '/alerts/recordings',
      '/alerts/occurrences',
      '/attendance',
      '/reports/attendance',
      '/reports/sos',
    ]);
    const offenders: string[] = [];
    for (const step of OPERATOR_TOUR_STEPS) {
      if (step.route && !operatorRoutes.has(step.route)) {
        offenders.push(`${step.titleKey} -> ${step.route}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('i18n parity across locales', () => {
  const locales = {
    en: enMessages,
    es: esMessages,
    ja: jaMessages,
    zh: zhMessages,
    pt: ptMessages,
  };

  function resolve(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let node: unknown = obj;
    for (const p of parts) {
      if (!node || typeof node !== 'object') return undefined;
      node = (node as Record<string, unknown>)[p];
    }
    return node;
  }

  it('every tour step key resolves to a non-empty string in every locale', () => {
    const missing: string[] = [];
    for (const step of [...ADMIN_TOUR_STEPS, ...OPERATOR_TOUR_STEPS]) {
      for (const [lang, bundle] of Object.entries(locales)) {
        const title = resolve(bundle, step.titleKey);
        const content = resolve(bundle, step.contentKey);
        if (typeof title !== 'string' || !title.trim()) missing.push(`${lang}:${step.titleKey}`);
        if (typeof content !== 'string' || !content.trim()) missing.push(`${lang}:${step.contentKey}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('nextWithProgress uses {current} and {total} placeholders in every locale', () => {
    for (const [lang, bundle] of Object.entries(locales)) {
      const label = resolve(bundle, 'onboarding.controls.nextWithProgress');
      expect(typeof label === 'string' && label.includes('{current}') && label.includes('{total}'))
        .toBe(true);
      if (typeof label !== 'string') throw new Error(`${lang} missing nextWithProgress`);
    }
  });

  it('no em-dash (U+2014) appears anywhere in the onboarding block of any locale', () => {
    const offenders: string[] = [];
    for (const [lang, bundle] of Object.entries(locales)) {
      const block = JSON.stringify(resolve(bundle, 'onboarding') ?? {});
      if (block.includes('\u2014')) offenders.push(lang);
    }
    expect(offenders).toEqual([]);
  });
});
