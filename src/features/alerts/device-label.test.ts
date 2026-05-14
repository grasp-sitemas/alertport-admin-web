import { describe, expect, test } from 'vitest';
import { formatDeviceLabel, isLegacyGwrondaAction, resolveCallTargetId } from './device-label';
import type { Company, Equipment, PatrolAction } from '@/types/api';

const base = {} as PatrolAction;

const makeCompany = (name: string): Company =>
  ({ _id: 'c1', name, status: 'ACTIVE' }) as unknown as Company;

const makeEquipment = (overrides: Partial<Equipment>): Equipment =>
  ({ _id: 'e1', code: '', status: 'ACTIVE', ...overrides }) as Equipment;

describe('isLegacyGwrondaAction', () => {
  test('legacyEventId present → true', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyEventId: '12345' })).toBe(true);
  });

  test('legacyEventType present → true', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyEventType: 7 })).toBe(true);
  });

  test('legacyReaderCode present → true', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyReaderCode: '354899040441351' })).toBe(true);
  });

  test('no legacy markers → false', () => {
    expect(isLegacyGwrondaAction(base)).toBe(false);
  });

  test('empty string legacyEventId → false (falsy)', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyEventId: '' })).toBe(false);
  });

  test('legacyEventType=0 → false (falsy — sanity)', () => {
    expect(isLegacyGwrondaAction({ ...base, legacyEventType: 0 })).toBe(false);
  });
});

describe('resolveCallTargetId', () => {
  test('returns deviceId when present', () => {
    expect(resolveCallTargetId({ deviceInfo: { deviceId: 'abc-123' } } as PatrolAction)).toBe(
      'abc-123',
    );
  });

  test('returns null when deviceInfo missing', () => {
    expect(resolveCallTargetId({} as PatrolAction)).toBeNull();
  });

  test('returns null when deviceId missing', () => {
    expect(resolveCallTargetId({ deviceInfo: {} } as PatrolAction)).toBeNull();
  });
});

describe('formatDeviceLabel', () => {
  test('AlertPort nativo: site populado + deviceId → "Site - last4"', () => {
    expect(
      formatDeviceLabel({
        ...base,
        site: makeCompany('Hospital Brasil'),
        deviceInfo: { deviceId: '354899040501451' },
      }),
    ).toBe('Hospital Brasil - 1451');
  });

  test('GWRonda legacy: site=null + client populado + equipment.uniqueId → "Client - last4"', () => {
    expect(
      formatDeviceLabel({
        ...base,
        site: null as unknown as PatrolAction['site'],
        client: makeCompany('WE MONITORAMENTO'),
        equipment: makeEquipment({ uniqueId: '354899040501451' }),
      }),
    ).toBe('WE MONITORAMENTO - 1451');
  });

  test('GWRonda legacy sem deviceInfo: usa equipment.uniqueId no fallback', () => {
    expect(
      formatDeviceLabel({
        ...base,
        site: null as unknown as PatrolAction['site'],
        client: makeCompany('ALSA FORT'),
        equipment: makeEquipment({ uniqueId: '867622012650613' }),
      }),
    ).toBe('ALSA FORT - 0613');
  });

  test('site + client ambos ausentes: "Dispositivo …last4"', () => {
    expect(
      formatDeviceLabel({
        ...base,
        equipment: makeEquipment({ uniqueId: '354899040501451' }),
      }),
    ).toBe('Dispositivo …1451');
  });

  test('tudo ausente: "Dispositivo AlertPort"', () => {
    expect(formatDeviceLabel({ ...base })).toBe('Dispositivo AlertPort');
  });

  test('preserva fluxo nativo quando site populado, ignora client', () => {
    expect(
      formatDeviceLabel({
        ...base,
        site: makeCompany('Filial A'),
        client: makeCompany('Cliente X'),
        deviceInfo: { deviceId: 'abc1234' },
      }),
    ).toBe('Filial A - 1234');
  });

  test('site presente sem device ainda funciona', () => {
    expect(
      formatDeviceLabel({
        ...base,
        site: makeCompany('Hospital Brasil'),
      }),
    ).toBe('Hospital Brasil');
  });

  test('client presente sem device: retorna nome do cliente', () => {
    expect(
      formatDeviceLabel({
        ...base,
        client: makeCompany('WE MONITORAMENTO'),
      }),
    ).toBe('WE MONITORAMENTO');
  });

  test('deviceInfo.deviceId tem precedência sobre equipment.uniqueId', () => {
    expect(
      formatDeviceLabel({
        ...base,
        site: makeCompany('Filial'),
        deviceInfo: { deviceId: 'preferred-9999' },
        equipment: makeEquipment({ uniqueId: 'fallback-0000' }),
      }),
    ).toBe('Filial - 9999');
  });

  test('equipment.code fica acima de serialNumber e _id no fallback', () => {
    expect(
      formatDeviceLabel({
        ...base,
        site: makeCompany('X'),
        equipment: makeEquipment({ code: 'CODE1234', serialNumber: 'SN9999' }),
      }),
    ).toBe('X - 1234');
  });
});
