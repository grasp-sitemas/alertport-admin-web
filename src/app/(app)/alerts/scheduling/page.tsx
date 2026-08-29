'use client';

// Authenticated routes read sessionStorage at runtime and must never be
// pre-rendered. Required by CLAUDE.md and .claude/rules/nextjs-16.md.
export const dynamic = 'force-dynamic';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Filter, X } from 'lucide-react';
import nextDynamic from 'next/dynamic';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
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
import { SchedulePreviewDialog } from '@/features/alerts/schedule-preview-dialog';
import { alertsService } from '@/services/alerts.service';
import type { AlertSchedule } from '@/types/api';

/**
 * FullCalendar touches `window` and `document` at mount, so the view must
 * render client-only. `ssr: false` dynamic import keeps the page
 * static-prerender friendly and avoids hydration mismatches.
 */
const SchedulingCalendar = nextDynamic(
  () =>
    import('@/features/alerts/scheduling-calendar').then((m) => ({
      default: m.SchedulingCalendar,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)]">
        <Spinner size="lg" />
      </div>
    ),
  },
);

type FormState = { kind: 'closed' } | { kind: 'open'; mode: ScheduleFormMode; row?: AlertSchedule };

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
  // New preview-driven entry point for calendar event clicks. Carries the
  // clicked schedule plus the YYYY-MM-DD of that specific occurrence so the
  // dialog can show "this day" context without re-deriving from extendedProps.
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    schedule?: AlertSchedule;
    occurrenceDate?: string;
  }>({ open: false });

  const eventsFilter = useMemo(
    () => ({
      startDate: range?.start ?? '',
      endDate: range?.end ?? '',
      ...(hierarchy.account ? { account: hierarchy.account } : {}),
      ...(hierarchy.client ? { client: hierarchy.client } : {}),
      ...(hierarchy.site ? { site: hierarchy.site } : {}),
      ...(nameFilter ? { name: nameFilter } : {}),
      // "Todos" (statusFilter === '') NÃO força ACTIVE — antes esse
      // fallback escondia agendamentos arquivados mesmo quando o
      // operador selecionava "Todos" no filtro de status.
      ...(statusFilter ? { status: statusFilter as 'ACTIVE' | 'ARCHIVED' } : {}),
    }),
    [range, hierarchy, nameFilter, statusFilter],
  );

  const { events, isLoading, isFetching } = useScheduleEvents(eventsFilter, Boolean(range));

  const handleRangeChange = useCallback((r: { start: Date; end: Date }) => {
    setRange({ start: r.start.toISOString(), end: r.end.toISOString() });
  }, []);

  const handleEventClick = useCallback(
    (event: ScheduleCalendarEvent) => {
      // Safety net: o `useScheduleEvents` esconde ocorrências de dias
      // anteriores a hoje, mas se o cache estiver stale ou o operador
      // ficar com a página aberta atravessando a meia-noite, ainda é
      // possível clicar num evento já no passado. Usamos o início do
      // dia (00:00) como cutoff — mesmo critério da listagem.
      const startMs = new Date(event.start).getTime();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (!Number.isNaN(startMs) && startMs < startOfToday.getTime()) {
        toast.error(t('alerts.errors.scheduleAlreadyOccurred'));
        return;
      }
      // Click on a generated occurrence → open the rich preview that shows
      // schedule context plus 4 scoped actions (edit/delete × occurrence/
      // series). Replaces the old two-step ScheduleScopeDialog flow at this
      // single entry point.
      const occurrenceDate = (event.start || '').slice(0, 10);
      setPreviewState({
        open: true,
        schedule: event.extendedProps.row,
        occurrenceDate,
      });
    },
    [t],
  );

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
        // Flavio (07/05): exclusão da série deve afetar SOMENTE
        // ocorrências futuras — nunca a do momento nem as passadas
        // (atendidas/não atendidas). Forçamos startDate ao máximo
        // entre a data do row clicado e amanhã (dia local). Assim
        // hoje + passado ficam protegidos independentemente de qual
        // linha o operador clicou no calendário.
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toLocaleDateString('sv-SE');
        const rowDate = rowDateString(row);
        const startDate = !rowDate || rowDate < tomorrowStr ? tomorrowStr : rowDate;
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
    onSuccess: (response: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['alert-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['alert-schedule-events'] });
      toast.success(t('alerts.deleteSuccess'));
      if (
        response &&
        typeof response === 'object' &&
        (response as { syncPending?: unknown }).syncPending === true
      ) {
        toast.warning(t('alerts.errors.firestorePushFailed'));
      }
      setFormState({ kind: 'closed' });
      // Close the preview dialog when the delete originated there. Cheap
      // and idempotent: collapsing also when triggered via legacy paths is
      // fine because the preview is already closed in that scenario.
      setPreviewState({ open: false });
    },
    onError: (err) => {
      const code = (err as Error)?.message || '';
      if (code === 'MISSING_SCHEDULE_ID' || code === 'MISSING_APPOINTMENT_ID') {
        toast.error(t('alerts.errors.missingReference'));
        return;
      }
      // Bug A2 (Flavio 09/05): bulk/series delete was failing without
      // any actionable feedback. Surface the actual axios response body
      // so the operator sees the real reason (400/404/500 from
      // ms-schedule) instead of a generic toast.
      const axiosErr = err as {
        response?: {
          data?: {
            message?: string;
            messageId?: string;
            errors?: Array<{ id?: string; text?: string }>;
          };
        };
        message?: string;
      };
      const backendMessage =
        axiosErr?.response?.data?.message ||
        axiosErr?.response?.data?.messageId ||
        axiosErr?.response?.data?.errors?.[0]?.text ||
        axiosErr?.message;
      if (backendMessage && backendMessage !== 'UNKNOWN') {
        toast.error(backendMessage);
        return;
      }
      toast.error(t('notifications.errorOccurred'));
    },
  });

  // ── Preview dialog callbacks ───────────────────────────────────
  // The preview is the single entry point for calendar clicks. It hands
  // off to ScheduleFormDialog for edits and to deleteMutation for deletes.
  // The dialog stays open during a delete so the operator sees the busy
  // state; deleteMutation.onSuccess closes it.
  const handlePreviewEditOccurrence = useCallback(() => {
    if (!previewState.schedule) return;
    const row = previewState.schedule;
    setPreviewState({ open: false });
    setFormState({ kind: 'open', mode: 'edit-occurrence', row });
  }, [previewState]);

  const handlePreviewEditSeries = useCallback(() => {
    if (!previewState.schedule) return;
    const row = previewState.schedule;
    setPreviewState({ open: false });
    setFormState({ kind: 'open', mode: 'edit-series', row });
  }, [previewState]);

  const handlePreviewDeleteOccurrence = useCallback(() => {
    if (!previewState.schedule) return;
    deleteMutation.mutate({ scope: 'occurrence', row: previewState.schedule });
  }, [previewState, deleteMutation]);

  const handlePreviewDeleteSeries = useCallback(() => {
    if (!previewState.schedule) return;
    deleteMutation.mutate({ scope: 'series', row: previewState.schedule });
  }, [previewState, deleteMutation]);

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
      <ModuleGuard moduleKey="SCHEDULING">
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
                    <span className="bg-brand-600/30 text-brand-300 ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold">
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
              className="space-y-3 rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-3"
            >
              {/* Row 1 — hierarchy + schedule name. Four equal columns on
               lg+ so the four fields always line up. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <HierarchyFilters value={hierarchy} onChange={setHierarchy} />
                <div className="space-y-1">
                  <Label className="text-text-secondary text-xs">{t('alerts.scheduleName')}</Label>
                  <Input
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder={t('alerts.scheduleName')}
                  />
                </div>
              </div>
              {/* Row 2 — status + Limpar filtros on the same baseline. The
               status field keeps the same width as row-1 fields (1fr out
               of the visual 4-col grid) and the button sits to its
               right, right-aligned at md+. */}
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="w-full space-y-1 md:w-1/4">
                  <Label className="text-text-secondary text-xs">{t('common.status')}</Label>
                  <select
                    value={statusFilter || '__all__'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStatusFilter(v === '__all__' ? '' : (v as 'ACTIVE' | 'ARCHIVED'));
                    }}
                    className="h-9 w-full rounded-md border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 text-sm"
                  >
                    <option value="__all__">{t('common.all')}</option>
                    <option value="ACTIVE">{t('common.active')}</option>
                    <option value="ARCHIVED">{t('common.archived')}</option>
                  </select>
                </div>
                <div className="md:ml-auto">
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    <X className="h-4 w-4" />
                    {t('common.clearFilters')}
                  </Button>
                </div>
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

          <SchedulePreviewDialog
            open={previewState.open}
            onOpenChange={(next) => {
              if (!next) setPreviewState({ open: false });
            }}
            schedule={previewState.schedule}
            occurrenceDate={previewState.occurrenceDate}
            onEditOccurrence={handlePreviewEditOccurrence}
            onEditSeries={handlePreviewEditSeries}
            onDeleteOccurrence={handlePreviewDeleteOccurrence}
            onDeleteSeries={handlePreviewDeleteSeries}
            isDeleting={deleteMutation.isPending}
          />

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
      </ModuleGuard>
    </RoleGuard>
  );
}
