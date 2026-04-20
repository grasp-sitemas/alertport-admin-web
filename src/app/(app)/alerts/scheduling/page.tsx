'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Filter, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoleGuard } from '@/components/shared/role-guard';
import {
  HierarchyFilters,
  type HierarchyFiltersValue,
} from '@/components/shared/hierarchy-filters';
import { Spinner } from '@/components/ui/spinner';
import { useScheduleEvents } from '@/features/alerts/use-schedule-events';
import type { ScheduleCalendarEvent } from '@/features/alerts/scheduling-calendar';
import { ScheduleFormDialog, type ScheduleFormMode } from '@/features/alerts/schedule-form-dialog';
import {
  ScheduleScopeDialog,
  type ScheduleScope,
  type ScheduleScopeAction,
} from '@/features/alerts/schedule-scope-dialog';
import { alertsService } from '@/services/alerts.service';
import type { AlertSchedule } from '@/types/api';

/**
 * FullCalendar touches `window` and `document` at mount, so the view must
 * render client-only. `ssr: false` dynamic import keeps the page
 * static-prerender friendly and avoids hydration mismatches.
 */
const SchedulingCalendar = dynamic(
  () =>
    import('@/features/alerts/scheduling-calendar').then((m) => ({
      default: m.SchedulingCalendar,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)]">
        <Spinner size="lg" />
      </div>
    ),
  },
);

type FormState =
  | { kind: 'closed' }
  | { kind: 'open'; mode: ScheduleFormMode; row?: AlertSchedule };

interface PendingScope {
  action: ScheduleScopeAction;
  row: AlertSchedule;
}

function resolveScheduleId(row: AlertSchedule): string {
  const ref = (row as { schedule?: unknown }).schedule;
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && '_id' in ref) {
    const id = (ref as { _id?: unknown })._id;
    if (typeof id === 'string') return id;
  }
  return row._id || '';
}

function resolveAppointmentId(row: AlertSchedule): string {
  const nested = (row as { appointment?: { _id?: string } }).appointment?._id;
  if (nested) return nested;
  return row.id || row._id || '';
}

function rowDateString(row: AlertSchedule): string {
  const raw =
    row.startDate ??
    row.start ??
    row.appointment?.startDate ??
    row.appointment?.start ??
    row.beginDate ??
    '';
  if (!raw) return '';
  if (raw.length === 10) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function AlertSchedulingPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | ''>('ACTIVE');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [formState, setFormState] = useState<FormState>({ kind: 'closed' });
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [pendingScope, setPendingScope] = useState<PendingScope | null>(null);

  const eventsFilter = useMemo(
    () => ({
      startDate: range?.start ?? '',
      endDate: range?.end ?? '',
      ...(hierarchy.account ? { account: hierarchy.account } : {}),
      ...(hierarchy.client ? { client: hierarchy.client } : {}),
      ...(hierarchy.site ? { site: hierarchy.site } : {}),
      ...(nameFilter ? { name: nameFilter } : {}),
      status: statusFilter || 'ACTIVE',
    }),
    [range, hierarchy, nameFilter, statusFilter],
  );

  const { events, isLoading, isFetching } = useScheduleEvents(eventsFilter, Boolean(range));

  const handleRangeChange = useCallback(
    (r: { start: Date; end: Date }) => {
      setRange({ start: r.start.toISOString(), end: r.end.toISOString() });
    },
    [],
  );

  const handleEventClick = useCallback((event: ScheduleCalendarEvent) => {
    // Click on a generated occurrence → ask whether to edit just today
    // or the whole series via the scope dialog.
    setPendingScope({ action: 'edit', row: event.extendedProps.row });
  }, []);

  const handleDateSelect = useCallback(
    ({ startISO, allDay }: { startISO: string; endISO: string; allDay: boolean }) => {
      // Click-to-create: pre-fills the start date so the operator only
      // has to pick the hierarchy and time window.
      const day = startISO.slice(0, 10);
      setFormState({
        kind: 'open',
        mode: 'create',
        row: {
          _id: '',
          name: '',
          frequency: 'DAILY',
          category: 'ALERT_CHECK',
          beginDate: day,
          endDate: allDay ? day : '',
          beginHour: '08:00',
          endHour: '18:00',
          status: 'ACTIVE',
          alertConfig: {
            alertType: 'FIXED',
            fixedInterval: 30,
            durationMin: 2,
            volumeLevel: 80,
          },
        } as unknown as AlertSchedule,
      });
    },
    [],
  );

  const deleteMutation = useMutation({
    mutationFn: async ({ scope, row }: { scope: ScheduleScope; row: AlertSchedule }) => {
      const scheduleId = resolveScheduleId(row);
      if (!scheduleId) throw new Error('MISSING_SCHEDULE_ID');
      if (scope === 'series') {
        const startDate = rowDateString(row) || new Date().toISOString().slice(0, 10);
        return alertsService.cancelAppointmentSeries({
          schedule: scheduleId,
          startDate,
          alertOccurrence: true,
        });
      }
      const appointmentId = resolveAppointmentId(row);
      if (!appointmentId) throw new Error('MISSING_APPOINTMENT_ID');
      return alertsService.cancelAppointmentOccurrence({
        appointment: appointmentId,
        schedule: scheduleId,
        alertOccurrence: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['alert-schedule-events'] });
      toast.success(t('alerts.deleteSuccess'));
      setFormState({ kind: 'closed' });
    },
    onError: (err) => {
      const code = (err as Error)?.message || '';
      if (code === 'MISSING_SCHEDULE_ID' || code === 'MISSING_APPOINTMENT_ID') {
        toast.error(t('alerts.errors.missingReference'));
        return;
      }
      toast.error(t('notifications.errorOccurred'));
    },
  });

  const handleScopePick = useCallback(
    (scope: ScheduleScope) => {
      if (!pendingScope) return;
      const { action, row } = pendingScope;
      setPendingScope(null);

      if (action === 'edit') {
        setFormState({
          kind: 'open',
          mode: scope === 'series' ? 'edit-series' : 'edit-occurrence',
          row,
        });
        return;
      }
      deleteMutation.mutate({ scope, row });
    },
    [pendingScope, deleteMutation],
  );

  const handleFormDeleteRequest = useCallback(() => {
    if (formState.kind !== 'open' || !formState.row) return;
    setPendingScope({ action: 'delete', row: formState.row });
  }, [formState]);

  const clearAllFilters = () => {
    setHierarchy({});
    setNameFilter('');
    setStatusFilter('ACTIVE');
  };

  const activeFilterCount =
    Number(Boolean(hierarchy.account)) +
    Number(Boolean(hierarchy.client)) +
    Number(Boolean(hierarchy.site)) +
    Number(Boolean(nameFilter)) +
    Number(statusFilter !== 'ACTIVE');

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN', 'MANAGER']}>
      <div className="space-y-4">
        <PageHeader
          title={t('alerts.scheduling')}
          action={
            <div className="flex gap-2">
              <Button
                variant={filtersOpen ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls="alerts-scheduling-filters"
              >
                <Filter className="h-4 w-4" />
                {t('common.filters')}
                {activeFilterCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-brand-600/30 text-brand-300 text-[10px] font-bold h-4 min-w-[1rem] px-1">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <Button
                onClick={() => setFormState({ kind: 'open', mode: 'create', row: undefined })}
              >
                <Plus className="h-4 w-4" />
                {t('alerts.createSchedule')}
              </Button>
            </div>
          }
        />

        {/* Compact collapsible filter drawer - keeps the calendar as the
           visual hero of the page. Opens on demand; shows a counter badge
           when non-default filters are applied so the operator knows
           something is filtering the view. */}
        {filtersOpen && (
          <div
            id="alerts-scheduling-filters"
            className="rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-3 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <HierarchyFilters value={hierarchy} onChange={setHierarchy} />
              <div className="space-y-1">
                <Label className="text-xs text-text-secondary">{t('alerts.scheduleName')}</Label>
                <Input
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder={t('alerts.scheduleName')}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-text-secondary">{t('common.status')}</Label>
                <select
                  value={statusFilter || '__all__'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStatusFilter(v === '__all__' ? '' : (v as 'ACTIVE' | 'ARCHIVED'));
                  }}
                  className="w-full h-9 rounded-md border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 text-sm"
                >
                  <option value="__all__">{t('common.all')}</option>
                  <option value="ACTIVE">{t('common.active')}</option>
                  <option value="ARCHIVED">{t('common.archived')}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="h-4 w-4" />
                {t('common.clearFilters')}
              </Button>
            </div>
          </div>
        )}

        <SchedulingCalendar
          events={events}
          loading={isLoading || isFetching}
          onRangeChange={handleRangeChange}
          onEventClick={handleEventClick}
          onDateSelect={handleDateSelect}
        />

        {formState.kind === 'open' && (
          <ScheduleFormDialog
            open={true}
            onOpenChange={(next) => {
              if (!next) setFormState({ kind: 'closed' });
            }}
            schedule={formState.row}
            mode={formState.mode}
            onDeleteRequest={formState.mode !== 'create' ? handleFormDeleteRequest : undefined}
          />
        )}

        {pendingScope && (
          <ScheduleScopeDialog
            open
            action={pendingScope.action}
            eventLabel={pendingScope.row.name || undefined}
            onChoose={handleScopePick}
            onCancel={() => setPendingScope(null)}
            isWorking={deleteMutation.isPending}
          />
        )}
      </div>
    </RoleGuard>
  );
}
