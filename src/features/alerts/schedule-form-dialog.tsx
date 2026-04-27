'use client';

import { useEffect } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useAppForm } from '@/hooks/use-app-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  alertScheduleSchema,
  type AlertScheduleFormValues,
  DEFAULT_ALERT_SCHEDULE,
} from './schemas';
import { alertsService } from '@/services/alerts.service';
import type { AlertSchedule } from '@/types/api';
import {
  useAccountsLookup,
  useClientsLookup,
  useSitesLookup,
  useEquipmentsBySiteLookup,
} from '@/features/shared/use-hierarchy-lookups';
import { isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';

export type ScheduleFormMode = 'create' | 'edit-series' | 'edit-occurrence';

interface ScheduleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Source row the form is editing. Ignored when mode='create'. */
  schedule?: AlertSchedule;
  /** Distinguishes the three CRUD paths this dialog drives. */
  mode?: ScheduleFormMode;
  /**
   * Fired when the user clicks the Delete button inside the form. The
   * parent is expected to open the scope dialog (series vs occurrence)
   * and handle the actual mutation. The form itself never deletes - it
   * just asks the parent to start the delete flow.
   */
  onDeleteRequest?: () => void;
  /**
   * Optional callback fired after a successful save. The parent can use
   * this to invalidate its own query cache. The form invalidates the
   * shared `alert-schedules` + `alert-schedule-events` keys by default.
   */
  onSaved?: () => void;
}

function getIdOrEmpty(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && '_id' in v) {
    const id = (v as { _id?: unknown })._id;
    return typeof id === 'string' ? id : '';
  }
  return '';
}

/**
 * Pull the YYYY-MM-DD piece out of whatever datetime string the backend
 * shipped. FullCalendar occurrences arrive as `start`/`startDate` (ISO),
 * plain schedules arrive as `beginDate` (already date-only).
 */
function extractDayPart(row: AlertSchedule | undefined): string {
  const raw =
    row?.startDate ??
    row?.start ??
    row?.appointment?.startDate ??
    row?.appointment?.start ??
    row?.beginDate ??
    '';
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (raw.length === 10) return raw; // already YYYY-MM-DD
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Normalize whatever the backend sent (YYYY-MM-DD OR full ISO datetime
 * OR null) to the YYYY-MM-DD format that `<input type="date">` expects.
 * Without this, a series edit on an appointment-shape row gets an ISO
 * string and the native input silently refuses to render it.
 */
function normalizeDatePart(raw: string | null | undefined): string {
  if (!raw) return '';
  if (raw.length === 10) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Read the schedule name from wherever it's available on the incoming
 * row. The calendar filter returns the appointment shape - `name` lives
 * at the top level there. But defensively support a nested `schedule`
 * object for robustness.
 */
function extractScheduleName(row: AlertSchedule | undefined): string {
  if (!row) return '';
  if (typeof row.name === 'string' && row.name.trim()) return row.name;
  const nested = (row as { schedule?: unknown }).schedule;
  if (nested && typeof nested === 'object' && 'name' in nested) {
    const n = (nested as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim()) return n;
  }
  return '';
}

function extractHourPart(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (raw.length <= 5) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return fallback;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Resolve the schedule's stable _id regardless of which shape the row
 * arrived in. Calendar appointments nest it under `schedule`; plain
 * schedule rows expose it directly as `_id`.
 */
function resolveScheduleId(row: AlertSchedule | undefined): string {
  if (!row) return '';
  const ref = (row as { schedule?: unknown }).schedule;
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && '_id' in ref) {
    const id = (ref as { _id?: unknown })._id;
    if (typeof id === 'string') return id;
  }
  return row._id || '';
}

function resolveAppointmentId(row: AlertSchedule | undefined): string {
  if (!row) return '';
  // Appointment-shape row: `row._id` might be the appointment's own id
  // (some v2 responses flatten it), plus `row.appointment._id` in others.
  const nested = (row as { appointment?: { _id?: string } }).appointment?._id;
  if (nested) return nested;
  return row.id || row._id || '';
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  schedule,
  mode = schedule ? 'edit-series' : 'create',
  onDeleteRequest,
  onSaved,
}: ScheduleFormDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { userSubtype, user: sessionUser } = useAuth();
  const isCreate = mode === 'create';
  const isOccurrenceEdit = mode === 'edit-occurrence';
  const canSelectAccount = isSuperAdminMaster(userSubtype);
  const sessionAccountId =
    typeof sessionUser?.account === 'object' ? sessionUser.account?._id : undefined;

  // For an occurrence edit we pin the calendar date to the clicked day.
  // The date inputs become read-only (visual hint that "this day only"
  // is the scope) and frequency controls are hidden entirely.
  const pinnedDay = schedule ? extractDayPart(schedule) : '';

  // Fetch the FULL schedule doc on edit. The calendar returns an
  // appointment-shape row that's great for painting events but misses
  // (or reformats) series-wide fields like `name`, `endDate`,
  // `frequency`, `weeklyDays`, `frequencyMonth/Year`, and `alertConfig`.
  // Without this fetch the edit form shows half-empty fields on every
  // series open. Fires only for edit modes + once the dialog is open so
  // we don't prefetch a schedule the user never edits.
  const scheduleIdToFetch = !isCreate ? resolveScheduleId(schedule) : '';
  const scheduleQuery = useQuery({
    queryKey: ['schedule-full', scheduleIdToFetch],
    queryFn: () => alertsService.getScheduleById(scheduleIdToFetch),
    enabled: open && !isCreate && !!scheduleIdToFetch,
    staleTime: 30 * 1000,
  });
  const fullSchedule = scheduleQuery.data ?? null;

  // Merge order: DEFAULTS < calendar row < full-schedule fetch. The
  // full schedule wins for series-wide fields; the calendar row wins
  // for the appointment-specific date/time displayed in the header.
  const mergedSource: AlertSchedule | undefined = schedule
    ? ({ ...(fullSchedule ?? {}), ...schedule } as AlertSchedule)
    : undefined;
  // `name`, `frequency`, `weeklyDays`, `frequencyMonth/Year`,
  // `alertConfig`, `endDate` come from the full schedule when
  // available - the appointment row tends to blank those out.
  const nameSource = extractScheduleName(fullSchedule ?? schedule);
  const seriesBeginDate = normalizeDatePart(
    (fullSchedule as AlertSchedule | null)?.beginDate ?? schedule?.beginDate,
  );
  const seriesEndDate = normalizeDatePart(
    (fullSchedule as AlertSchedule | null)?.endDate ?? schedule?.endDate,
  );

  const defaults: AlertScheduleFormValues = mergedSource
    ? {
        ...DEFAULT_ALERT_SCHEDULE,
        ...mergedSource,
        name: nameSource,
        account: getIdOrEmpty(mergedSource.account) || (canSelectAccount ? '' : sessionAccountId || ''),
        client: getIdOrEmpty(mergedSource.client),
        site: getIdOrEmpty(mergedSource.site),
        equipment: getIdOrEmpty(mergedSource.equipment),
        beginDate: isOccurrenceEdit ? pinnedDay : seriesBeginDate || pinnedDay,
        endDate: isOccurrenceEdit ? pinnedDay : seriesEndDate,
        beginHour: extractHourPart(mergedSource.beginHour || mergedSource.startHour, '08:00'),
        endHour: extractHourPart(mergedSource.endHour, '18:00'),
        weeklyDays:
          (fullSchedule as AlertSchedule | null)?.weeklyDays ?? mergedSource.weeklyDays ?? [],
        frequencyMonth:
          (fullSchedule as AlertSchedule | null)?.frequencyMonth ??
          mergedSource.frequencyMonth ?? { day: '' },
        frequencyYear:
          (fullSchedule as AlertSchedule | null)?.frequencyYear ??
          mergedSource.frequencyYear ?? { month: '', day: '' },
        // Single-day edits are always NOT_REPEAT from the schema's PoV;
        // the backend rebuilds just this appointment anyway.
        frequency: isOccurrenceEdit
          ? 'NOT_REPEAT'
          : (fullSchedule as AlertSchedule | null)?.frequency ?? mergedSource.frequency ?? 'DAILY',
        alertConfig:
          (fullSchedule as AlertSchedule | null)?.alertConfig ??
          mergedSource.alertConfig ??
          DEFAULT_ALERT_SCHEDULE.alertConfig,
        status:
          (fullSchedule as AlertSchedule | null)?.status ??
          mergedSource.status ??
          'ACTIVE',
      }
    : {
        ...DEFAULT_ALERT_SCHEDULE,
        account: canSelectAccount ? '' : sessionAccountId || '',
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useAppForm<AlertScheduleFormValues>({
    resolver: zodResolver(alertScheduleSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    // Reset fires on: dialog open, source row swap, mode change, OR
    // when the async full-schedule fetch settles. The last one is
    // critical - without it the form would render once with the
    // half-filled calendar row and never re-hydrate when the complete
    // schedule arrives a few hundred ms later.
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?._id, mode, scheduleQuery.dataUpdatedAt]);

  const accountWatched = useWatch({ control, name: 'account' });
  const clientWatched = useWatch({ control, name: 'client' });
  const siteWatched = useWatch({ control, name: 'site' });
  const beginDateWatched = useWatch({ control, name: 'beginDate' });
  const frequency = useWatch({ control, name: 'frequency' });
  const alertType = useWatch({ control, name: 'alertConfig.alertType' });

  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(accountWatched || undefined);
  const sitesLookup = useSitesLookup(clientWatched || undefined, accountWatched || undefined);
  const equipmentsLookup = useEquipmentsBySiteLookup({
    account: accountWatched || undefined,
    client: clientWatched || undefined,
    site: siteWatched || undefined,
  });
  const getValidationText = (message?: string) => {
    if (!message) return '';
    try {
      const translated = t(message);
      return translated && translated !== message ? translated : message;
    } catch {
      return message;
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: AlertScheduleFormValues) => {
      const normalized: AlertScheduleFormValues = {
        ...data,
        frequencyMonth: data.frequencyMonth ? { day: data.frequencyMonth.day ?? '' } : { day: '' },
        frequencyYear: data.frequencyYear
          ? {
              month: data.frequencyYear.month ?? '',
              day: data.frequencyYear.day ?? '',
            }
          : { month: '', day: '' },
      };

      if (mode === 'create') {
        return alertsService.createSchedule(normalized);
      }

      const scheduleId = resolveScheduleId(schedule);
      if (!scheduleId) throw new Error('MISSING_SCHEDULE_ID');

      if (mode === 'edit-occurrence') {
        const appointmentId = resolveAppointmentId(schedule);
        if (!appointmentId) throw new Error('MISSING_APPOINTMENT_ID');
        return alertsService.updateAppointmentOccurrence({
          schedule: scheduleId,
          appointment: appointmentId,
          name: normalized.name,
          account: normalized.account,
          client: normalized.client,
          site: normalized.site,
          equipment: normalized.equipment,
          category: 'ALERT_CHECK',
          beginDate: pinnedDay || normalized.beginDate,
          endDate: pinnedDay || normalized.endDate,
          beginHour: normalized.beginHour,
          endHour: normalized.endHour,
          alertConfig: normalized.alertConfig,
        });
      }

      // edit-series: scheduleId goes on `schedule` (NOT `_id`) because
      // ms-schedule's updateSchedule controller reads it from there.
      return alertsService.updateScheduleSeries({
        ...normalized,
        schedule: scheduleId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['alert-schedule-events'] });
      toast.success(t('notifications.savedSuccessfully'));
      onOpenChange(false);
      reset(DEFAULT_ALERT_SCHEDULE);
      onSaved?.();
    },
    onError: (err) => {
      const code = (err as Error)?.message || 'UNKNOWN';
      if (code === 'MISSING_SCHEDULE_ID' || code === 'MISSING_APPOINTMENT_ID') {
        toast.error(t('alerts.errors.missingReference'));
        return;
      }
      toast.error(t('notifications.errorOccurred'));
    },
  });

  const titleKey =
    mode === 'create'
      ? 'alerts.createSchedule'
      : mode === 'edit-occurrence'
        ? 'alerts.editOccurrenceTitle'
        : 'alerts.editSchedule';
  const descriptionKey =
    mode === 'edit-occurrence' ? 'alerts.editOccurrenceDescription' : 'alerts.scheduling';

  // Track previous cascade values locally - they get reinitialized on
  // every render, which is fine since the cascade resets only run inside
  // the onValueChange callbacks.
  let prevAccount = defaults.account ?? '';
  let prevClient = defaults.client ?? '';
  let prevSite = defaults.site ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          {/* Account / Client / Site / Equipment cascade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {canSelectAccount && (
              <div className="space-y-2 sm:col-span-3">
                <Label>{t('common.account')}</Label>
                <Controller
                  control={control}
                  name="account"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(val) => {
                        field.onChange(val);
                        if (val !== prevAccount) {
                          setValue('client', '');
                          setValue('site', '');
                          setValue('equipment', '');
                          prevAccount = val;
                        }
                      }}
                      disabled={isOccurrenceEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.selectOption')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(accountsLookup.data?.results ?? []).map((a) => (
                          <SelectItem key={a._id} value={a._id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('common.client')}</Label>
              <Controller
                control={control}
                name="client"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(val) => {
                      field.onChange(val);
                      if (val !== prevClient) {
                        setValue('site', '');
                        setValue('equipment', '');
                        prevClient = val;
                      }
                    }}
                    disabled={isOccurrenceEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectOption')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(clientsLookup.data?.results ?? []).map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.client && (
                <p className="text-xs text-red-400">{t(errors.client.message as string)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('common.site')}</Label>
              <Controller
                control={control}
                name="site"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(val) => {
                      field.onChange(val);
                      if (val !== prevSite) {
                        setValue('equipment', '');
                        prevSite = val;
                      }
                    }}
                    disabled={isOccurrenceEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectOption')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(sitesLookup.data?.results ?? []).map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.site && (
                <p className="text-xs text-red-400">{t(errors.site.message as string)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('alerts.equipment')}</Label>
              <Controller
                control={control}
                name="equipment"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={isOccurrenceEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectOption')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(equipmentsLookup.data?.results ?? []).map((e) => (
                        <SelectItem key={e._id} value={e._id}>
                          {e.code ?? e.name ?? e._id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.equipment && (
                <p className="text-xs text-red-400">{t(errors.equipment.message as string)}</p>
              )}
            </div>
          </div>

          <div className="h-px bg-white/10 my-2" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-3">
              <Label>{t('alerts.scheduleName')}</Label>
              <Input {...register('name')} />
              {errors.name && (
                <p className="text-xs text-red-400">{t(errors.name.message as string)}</p>
              )}
            </div>

            {!isOccurrenceEdit && (
              <div className="space-y-2">
                <Label>{t('alerts.frequency')}</Label>
                <Controller
                  control={control}
                  name="frequency"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? 'DAILY'}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setValue('weeklyDays', []);
                        setValue('frequencyMonth', { day: '' });
                        setValue('frequencyYear', { month: '', day: '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NOT_REPEAT">{t('alerts.notRepeat')}</SelectItem>
                        <SelectItem value="DAILY">{t('alerts.daily')}</SelectItem>
                        <SelectItem value="EVERY_OTHER_DAY">
                          {t('alerts.everyOtherDay')}
                        </SelectItem>
                        <SelectItem value="WEEKLY">{t('alerts.weekly')}</SelectItem>
                        <SelectItem value="MONTHLY">{t('alerts.monthly')}</SelectItem>
                        <SelectItem value="YEARLY">{t('alerts.yearly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value ?? 'ACTIVE'}
                    onValueChange={field.onChange}
                    disabled={isOccurrenceEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t('common.active')}</SelectItem>
                      <SelectItem value="ARCHIVED">{t('common.archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('alerts.beginDate')}</Label>
              <Input type="date" {...register('beginDate')} disabled={isOccurrenceEdit} />
              {errors.beginDate && (
                <p className="text-xs text-red-400">
                  {getValidationText(errors.beginDate.message as string)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('alerts.endDate')}</Label>
              <Input
                type="date"
                min={beginDateWatched || undefined}
                {...register('endDate')}
                disabled={isOccurrenceEdit}
              />
              {errors.endDate && (
                <p className="text-xs text-red-400">
                  {getValidationText(errors.endDate.message as string)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('alerts.beginHour')}</Label>
              <Input type="time" {...register('beginHour')} />
            </div>
            <div className="space-y-2">
              <Label>{t('alerts.endHour')}</Label>
              <Input type="time" {...register('endHour')} />
            </div>
          </div>

          {!isOccurrenceEdit && frequency === 'WEEKLY' && (
            <div className="space-y-2">
              <Label>{t('alerts.weeklyDays')}</Label>
              <Controller
                control={control}
                name="weeklyDays"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: 1, key: 'alerts.monday' },
                      { val: 2, key: 'alerts.tuesday' },
                      { val: 3, key: 'alerts.wednesday' },
                      { val: 4, key: 'alerts.thursday' },
                      { val: 5, key: 'alerts.friday' },
                      { val: 6, key: 'alerts.saturday' },
                      { val: 0, key: 'alerts.sunday' },
                    ].map((day) => {
                      const selected = (field.value || []).includes(day.val);
                      return (
                        <button
                          type="button"
                          key={day.val}
                          onClick={() => {
                            const current = field.value || [];
                            field.onChange(
                              selected
                                ? current.filter((d) => d !== day.val)
                                : [...current, day.val],
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            selected
                              ? 'bg-brand-600/20 border-brand-600/40 text-brand-400'
                              : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'
                          }`}
                        >
                          {t(day.key)}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>
          )}

          {!isOccurrenceEdit && frequency === 'MONTHLY' && (
            <div className="space-y-2 max-w-[200px]">
              <Label>{t('alerts.frequencyMonthDay')}</Label>
              <Input type="number" min={1} max={31} {...register('frequencyMonth.day')} />
            </div>
          )}

          {!isOccurrenceEdit && frequency === 'YEARLY' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div className="space-y-2">
                <Label>{t('alerts.frequencyYearMonth')}</Label>
                <Controller
                  control={control}
                  name="frequencyYear.month"
                  render={({ field }) => (
                    <Select
                      value={String(field.value ?? '')}
                      onValueChange={(val) => field.onChange(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.selectOption')} />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          'january',
                          'february',
                          'march',
                          'april',
                          'may',
                          'june',
                          'july',
                          'august',
                          'september',
                          'october',
                          'november',
                          'december',
                        ].map((name, idx) => (
                          <SelectItem key={idx} value={String(idx)}>
                            {t(`alerts.months.${name}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('alerts.frequencyYearDay')}</Label>
                <Input type="number" min={1} max={31} {...register('frequencyYear.day')} />
              </div>
            </div>
          )}

          <div className="h-px bg-white/10 my-2" />
          <h4 className="text-sm font-semibold text-white">{t('alerts.alertConfig')}</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('alerts.alertType')}</Label>
              <Controller
                control={control}
                name="alertConfig.alertType"
                render={({ field }) => (
                  <Select value={field.value ?? 'FIXED'} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">{t('alerts.fixed')}</SelectItem>
                      <SelectItem value="RANDOM">{t('alerts.random')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {alertType === 'FIXED' && (
              <div className="space-y-2">
                <Label>{t('alerts.fixedInterval')}</Label>
                <Input
                  type="number"
                  min={1}
                  {...register('alertConfig.fixedInterval', { valueAsNumber: true })}
                />
              </div>
            )}

            {alertType === 'RANDOM' && (
              <>
                <div className="space-y-2">
                  <Label>{t('alerts.randomMin')}</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register('alertConfig.randomMin', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('alerts.randomMax')}</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register('alertConfig.randomMax', { valueAsNumber: true })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{t('alerts.durationMin')}</Label>
              <Input
                type="number"
                min={0}
                {...register('alertConfig.durationMin', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('alerts.volumeLevel')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                {...register('alertConfig.volumeLevel', { valueAsNumber: true })}
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <div>
              {!isCreate && onDeleteRequest && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onDeleteRequest()}
                  disabled={isSubmitting || mutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || mutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {isSubmitting || mutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
