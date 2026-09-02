import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlertSchedule } from '@/types/api';
import { ScheduleFormDialog } from '@/features/alerts/schedule-form-dialog';

const serviceMocks = vi.hoisted(() => ({
  getScheduleById: vi.fn(),
  updateScheduleSeries: vi.fn(),
}));

vi.mock('@/services/alerts.service', () => ({
  alertsService: {
    getScheduleById: serviceMocks.getScheduleById,
    updateScheduleSeries: serviceMocks.updateScheduleSeries,
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    userSubtype: 'ADMIN',
    user: { account: { _id: 'acc-1' } },
  }),
}));

vi.mock('@/features/shared/use-hierarchy-lookups', () => ({
  useAccountsLookup: () => ({ data: { results: [] } }),
  useClientsLookup: () => ({
    data: {
      results: [
        { _id: 'client-1', name: 'Client 1' },
        { _id: 'client-2', name: 'Client 2' },
      ],
    },
  }),
  useSitesLookup: () => ({ data: { results: [{ _id: 'site-1', name: 'Site 1' }] } }),
  useEquipmentsBySiteLookup: () => ({
    data: { results: [{ _id: 'equipment-1', name: 'Equipment 1' }] },
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

function makeSchedule(overrides: Partial<AlertSchedule> = {}): AlertSchedule {
  return {
    _id: 'schedule-1',
    name: 'CEAG Guarulhos',
    account: 'acc-1',
    client: 'client-1',
    site: 'site-1',
    equipment: 'equipment-1',
    frequency: 'DAILY',
    category: 'ALERT_CHECK',
    beginDate: '2026-04-01',
    endDate: '2026-09-30',
    beginHour: '00:00',
    endHour: '23:59',
    status: 'ACTIVE',
    alertConfig: {
      alertType: 'FIXED',
      fixedInterval: 30,
      durationMin: 2,
      volumeLevel: 80,
    },
    ...overrides,
  };
}

describe('ScheduleFormDialog edit-series date scope', () => {
  const originalTimezone = process.env.TZ;

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.updateScheduleSeries.mockResolvedValue({ status: 200, result: {} });
  });

  afterEach(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
    cleanup();
  });

  it('keeps the clicked appointment day after full-schedule hydration and on submission', async () => {
    let resolveFullSchedule!: (schedule: AlertSchedule) => void;
    serviceMocks.getScheduleById.mockReturnValue(
      new Promise<AlertSchedule>((resolve) => {
        resolveFullSchedule = resolve;
      }),
    );

    const appointmentRow = makeSchedule({
      _id: 'appointment-1',
      startDate: '2026-08-26T12:00:00.000Z',
      // Calendar rows carry the stable schedule reference separately.
      ...({ schedule: { _id: 'schedule-1' } } as Partial<AlertSchedule>),
    });
    const persistedSchedule = makeSchedule({
      _id: 'schedule-1',
      beginDate: '2026-04-01',
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScheduleFormDialog
          open
          onOpenChange={vi.fn()}
          schedule={appointmentRow}
          mode="edit-series"
        />
      </QueryClientProvider>,
    );

    const beginDate = screen.getByTestId('schedule-begin-date') as HTMLInputElement;
    expect(beginDate.value).toBe('2026-08-26');

    await act(async () => {
      resolveFullSchedule(persistedSchedule);
      await Promise.resolve();
    });

    await waitFor(() => expect(beginDate.value).toBe('2026-08-26'));

    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => expect(serviceMocks.updateScheduleSeries).toHaveBeenCalledTimes(1));
    expect(serviceMocks.updateScheduleSeries.mock.calls[0][0]).toMatchObject({
      schedule: 'schedule-1',
      beginDate: '2026-08-26',
    });
  });

  it('keeps schedule begin and end as civil dates when the backend returns midnight UTC', async () => {
    process.env.TZ = 'America/Sao_Paulo';
    serviceMocks.getScheduleById.mockResolvedValue(
      makeSchedule({
        _id: 'schedule-1',
        beginDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-05T00:00:00.000Z',
      }),
    );
    const appointmentRow = makeSchedule({
      _id: 'appointment-1',
      startDate: '2026-09-02T00:45:00.000Z',
      ...({ schedule: { _id: 'schedule-1' } } as Partial<AlertSchedule>),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScheduleFormDialog
          open
          onOpenChange={vi.fn()}
          schedule={appointmentRow}
          mode="edit-series"
        />
      </QueryClientProvider>,
    );

    const endDate = document.querySelector<HTMLInputElement>('input[name="endDate"]');
    await waitFor(() => expect(endDate?.value).toBe('2026-09-05'));
  });

  it('does not overwrite operator changes when full-schedule hydration finishes', async () => {
    let resolveFullSchedule!: (schedule: AlertSchedule) => void;
    serviceMocks.getScheduleById.mockReturnValue(
      new Promise<AlertSchedule>((resolve) => {
        resolveFullSchedule = resolve;
      }),
    );
    const appointmentRow = makeSchedule({
      _id: 'appointment-1',
      name: 'Calendar row',
      startDate: '2026-09-02T00:45:00.000Z',
      ...({ schedule: { _id: 'schedule-1' } } as Partial<AlertSchedule>),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScheduleFormDialog
          open
          onOpenChange={vi.fn()}
          schedule={appointmentRow}
          mode="edit-series"
        />
      </QueryClientProvider>,
    );
    const name = document.querySelector<HTMLInputElement>('input[name="name"]');
    const endDate = document.querySelector<HTMLInputElement>('input[name="endDate"]');
    expect(name).not.toBeNull();
    expect(endDate).not.toBeNull();
    fireEvent.change(name!, { target: { value: 'Alteração do operador' } });

    await act(async () => {
      resolveFullSchedule(
        makeSchedule({
          _id: 'schedule-1',
          name: 'Persisted name',
          endDate: '2026-12-31',
        }),
      );
      await Promise.resolve();
    });

    await waitFor(() => expect(endDate?.value).toBe('2026-12-31'));
    expect(name?.value).toBe('Alteração do operador');
  });

  it('does not restore stale hierarchy children after the operator changes their parent', async () => {
    let resolveFullSchedule!: (schedule: AlertSchedule) => void;
    serviceMocks.getScheduleById.mockReturnValue(
      new Promise<AlertSchedule>((resolve) => {
        resolveFullSchedule = resolve;
      }),
    );
    const appointmentRow = makeSchedule({
      _id: 'appointment-1',
      startDate: '2026-09-02T00:45:00.000Z',
      ...({ schedule: { _id: 'schedule-1' } } as Partial<AlertSchedule>),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScheduleFormDialog
          open
          onOpenChange={vi.fn()}
          schedule={appointmentRow}
          mode="edit-series"
        />
      </QueryClientProvider>,
    );

    const [clientTrigger, siteTrigger, equipmentTrigger] = screen.getAllByRole('combobox');
    const clientNativeSelect = document.querySelectorAll('select')[0];
    fireEvent.change(clientNativeSelect, { target: { value: 'client-2' } });

    await act(async () => {
      resolveFullSchedule(makeSchedule({ _id: 'schedule-1', endDate: '2026-12-31' }));
      await Promise.resolve();
    });

    await waitFor(() => expect(clientTrigger).toHaveTextContent('Client 2'));
    expect(siteTrigger).toHaveTextContent('common.selectOption');
    expect(equipmentTrigger).toHaveTextContent('common.selectOption');
  });

  it('reuses the same idempotency key when an operator retries the same save attempt', async () => {
    serviceMocks.getScheduleById.mockResolvedValue(makeSchedule({ _id: 'schedule-1' }));
    serviceMocks.updateScheduleSeries
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({ status: 200, result: {} });
    const appointmentRow = makeSchedule({
      _id: 'appointment-1',
      startDate: '2026-09-02T12:00:00.000Z',
      ...({ schedule: { _id: 'schedule-1' } } as Partial<AlertSchedule>),
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScheduleFormDialog
          open
          onOpenChange={vi.fn()}
          schedule={appointmentRow}
          mode="edit-series"
        />
      </QueryClientProvider>,
    );

    const save = screen.getByRole('button', { name: 'common.save' });
    fireEvent.click(save);
    await waitFor(() => expect(serviceMocks.updateScheduleSeries).toHaveBeenCalledTimes(1));
    const firstKey = serviceMocks.updateScheduleSeries.mock.calls[0][1];
    expect(firstKey).toEqual(expect.any(String));

    fireEvent.click(save);
    await waitFor(() => expect(serviceMocks.updateScheduleSeries).toHaveBeenCalledTimes(2));
    expect(serviceMocks.updateScheduleSeries.mock.calls[1][1]).toBe(firstKey);
  });
});
