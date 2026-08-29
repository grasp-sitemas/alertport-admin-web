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
  useClientsLookup: () => ({ data: { results: [] } }),
  useSitesLookup: () => ({ data: { results: [] } }),
  useEquipmentsBySiteLookup: () => ({ data: { results: [] } }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.updateScheduleSeries.mockResolvedValue({ status: 200, result: {} });
  });

  afterEach(() => cleanup());

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
});
