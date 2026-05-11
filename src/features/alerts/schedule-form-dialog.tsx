'use client';

import { useEffect, useRef } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useAppForm } from '@/hooks/use-app-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { stripEmpty } from '@/lib/sanitize-payload';
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
 * YYYY-MM-DD da data LOCAL do operador (TZ do browser, igual a TZ da
 * empresa). NUNCA usar `toISOString().slice(0,10)` aqui — isso devolve
 * a data em UTC, e às 21h BRT (= 00h UTC do dia seguinte) o operador
 * acabaria agendando para o dia errado. O backend depois compõe com
 * `accountTimezone` em cima desse YYYY-MM-DD local pra gerar o trigger
 * UTC absoluto correto.
 */
function toLocalDayPart(d: Date): string {
  // 'sv-SE' devolve "YYYY-MM-DD" no fuso local — formato ISO 8601 date.
  return d.toLocaleDateString('sv-SE');
}

/**
 * Default name when the user opens "+ Criar Agendamento" (Flavio, 07/05).
 * Operador estava recebendo o campo vazio e o schema exige min 1. Usa
 * data+hora locais como placeholder editável — operador pode trocar
 * depois mas já tem algo razoável.
 */
function generateDefaultScheduleName(): string {
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `Agendamento ${date} ${time}`;
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
  if (!raw) return toLocalDayPart(new Date());
  if (raw.length === 10) return raw; // already YYYY-MM-DD
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return toLocalDayPart(new Date());
  return toLocalDayPart(d);
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
  return toLocalDayPart(d);
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
  // Backend stores schedule hours converted to UTC. Display them as-is in
  // UTC to round-trip cleanly through the form. Using getHours() (local
  // time) would shift the displayed hour by the user's timezone offset
  // and corrupt the value on save.
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
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

/**
 * Defensive sanitizer for the form defaults. Legacy backend documents
 * sometimes ship `null` for string fields the schema requires (e.g.
 * `equipment: null` on schedules created before the device was bound,
 * or `endDate: null` on open-ended series). Spreading `mergedSource`
 * into defaults would propagate that null and the Zod resolver would
 * reject the parse with "expected string, received null", surfacing as
 * the toast "verifique os campos antes de salvar" before the operator
 * even sees the form. We coerce every required string slot to '' here
 * so the existing `.min(1)` `validation.required` path runs instead.
 *
 * Deep coverage (Flavio, 11/05): the original sanitizer covered only
 * top-level strings. Legacy docs also ship null for nested fields —
 * notably `alertConfig.alertType` (enums in Zod are string-typed under
 * the hood, so null → "expected string, received null"), and
 * `frequencyMonth.day` / `frequencyYear.{month,day}` (union string|number,
 * also rejects null). We now rebuild those nested objects from scratch
 * with null/undefined coerced to safe defaults, and number fields in
 * `alertConfig` snapped to the DEFAULT_ALERT_SCHEDULE.alertConfig values
 * when null (Zod number rejects null).
 */
function sanitizeFormDefaults(values: AlertScheduleFormValues): AlertScheduleFormValues {
  const coerceStr = (v: unknown): string =>
    v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v);
  const coerceNum = (v: unknown, fallback: number): number => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const coerceStrOrNum = (v: unknown): string | number => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return v;
    return String(v);
  };

  const defaultAlertConfig = DEFAULT_ALERT_SCHEDULE.alertConfig;
  const rawAlertConfig = (values.alertConfig ?? defaultAlertConfig) as Partial<
    AlertScheduleFormValues['alertConfig']
  > | null;
  const ac = rawAlertConfig ?? defaultAlertConfig;
  const sanitizedAlertConfig: AlertScheduleFormValues['alertConfig'] = {
    alertType: ac.alertType === 'FIXED' || ac.alertType === 'RANDOM' ? ac.alertType : 'FIXED',
    fixedInterval: coerceNum(ac.fixedInterval, defaultAlertConfig.fixedInterval ?? 30),
    durationMin: coerceNum(ac.durationMin, defaultAlertConfig.durationMin ?? 2),
    volumeLevel: coerceNum(ac.volumeLevel, defaultAlertConfig.volumeLevel ?? 80),
    randomMin: coerceNum(ac.randomMin, defaultAlertConfig.randomMin ?? 0),
    randomMax: coerceNum(ac.randomMax, defaultAlertConfig.randomMax ?? 0),
  };

  const rawFreqMonth = values.frequencyMonth as
    | { day?: string | number | null }
    | null
    | undefined;
  const sanitizedFreqMonth: { day: string | number } = {
    day: coerceStrOrNum(rawFreqMonth?.day),
  };

  const rawFreqYear = values.frequencyYear as
    | { month?: string | number | null; day?: string | number | null }
    | null
    | undefined;
  const sanitizedFreqYear: { month: string | number; day: string | number } = {
    month: coerceStrOrNum(rawFreqYear?.month),
    day: coerceStrOrNum(rawFreqYear?.day),
  };

  // weeklyDays: drop null/undefined entries that legacy docs occasionally ship.
  const rawWeekly = Array.isArray(values.weeklyDays) ? values.weeklyDays : [];
  const sanitizedWeekly = rawWeekly.filter(
    (d): d is number => typeof d === 'number' && Number.isFinite(d),
  );

  const freqRaw = values.frequency as AlertScheduleFormValues['frequency'] | null | undefined;
  const validFrequencies: AlertScheduleFormValues['frequency'][] = [
    'NOT_REPEAT',
    'DAILY',
    'EVERY_OTHER_DAY',
    'WEEKLY',
    'MONTHLY',
    'YEARLY',
  ];
  const sanitizedFrequency: AlertScheduleFormValues['frequency'] =
    freqRaw && validFrequencies.includes(freqRaw) ? freqRaw : 'DAILY';

  const statusRaw = values.status as AlertScheduleFormValues['status'] | null | undefined;
  const sanitizedStatus: AlertScheduleFormValues['status'] =
    statusRaw === 'ACTIVE' || statusRaw === 'ARCHIVED' ? statusRaw : 'ACTIVE';

  return {
    ...values,
    _id: values._id == null ? undefined : String(values._id),
    name: coerceStr(values.name),
    account: values.account == null ? undefined : String(values.account),
    client: coerceStr(values.client),
    site: coerceStr(values.site),
    equipment: coerceStr(values.equipment),
    beginDate: coerceStr(values.beginDate),
    endDate: coerceStr(values.endDate),
    beginHour: coerceStr(values.beginHour),
    endHour: coerceStr(values.endHour),
    category: 'ALERT_CHECK',
    status: sanitizedStatus,
    frequency: sanitizedFrequency,
    weeklyDays: sanitizedWeekly,
    frequencyMonth: sanitizedFreqMonth,
    frequencyYear: sanitizedFreqYear,
    alertConfig: sanitizedAlertConfig,
  };
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
    ? ({ ...schedule, ...(fullSchedule ?? {}) } as AlertSchedule)
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

  // Calendar-click into create-mode (Bug A1, Flavio 09/05): the click
  // pre-fills `beginDate`/`endDate` on a partial AlertSchedule row but
  // leaves account/client/site/equipment/name blank. The merged-edit
  // branch below would silently send `account: ''` to the backend,
  // which Mongoose then rejects as a CastError on the ObjectId ref —
  // surfaced to the operator as a generic "Database Connection error".
  // For create mode we keep the create defaults (session account +
  // generated name) and overlay ONLY the dates from the click.
  const isCalendarClickCreate = isCreate && !!mergedSource;

  const defaults: AlertScheduleFormValues = isCalendarClickCreate
    ? {
        ...DEFAULT_ALERT_SCHEDULE,
        name: generateDefaultScheduleName(),
        account: canSelectAccount ? '' : sessionAccountId || '',
        beginDate: normalizeDatePart(mergedSource?.beginDate) || DEFAULT_ALERT_SCHEDULE.beginDate,
        endDate: normalizeDatePart(mergedSource?.endDate) || '',
      }
    : mergedSource
      ? {
          ...DEFAULT_ALERT_SCHEDULE,
          ...mergedSource,
          name: nameSource,
          account:
            getIdOrEmpty(mergedSource.account) || (canSelectAccount ? '' : sessionAccountId || ''),
          client: getIdOrEmpty(mergedSource.client),
          site: getIdOrEmpty(mergedSource.site),
          equipment: getIdOrEmpty(mergedSource.equipment),
          beginDate: isOccurrenceEdit ? pinnedDay : seriesBeginDate || pinnedDay,
          endDate: isOccurrenceEdit ? pinnedDay : seriesEndDate,
          beginHour: extractHourPart(mergedSource.beginHour || mergedSource.startHour, '08:00'),
          endHour: extractHourPart(mergedSource.endHour, '18:00'),
          weeklyDays:
            (fullSchedule as AlertSchedule | null)?.weeklyDays ?? mergedSource.weeklyDays ?? [],
          frequencyMonth: (fullSchedule as AlertSchedule | null)?.frequencyMonth ??
            mergedSource.frequencyMonth ?? { day: '' },
          frequencyYear: (fullSchedule as AlertSchedule | null)?.frequencyYear ??
            mergedSource.frequencyYear ?? { month: '', day: '' },
          // Single-day edits are always NOT_REPEAT from the schema's PoV;
          // the backend rebuilds just this appointment anyway.
          frequency: isOccurrenceEdit
            ? 'NOT_REPEAT'
            : ((fullSchedule as AlertSchedule | null)?.frequency ??
              mergedSource.frequency ??
              'DAILY'),
          alertConfig:
            (fullSchedule as AlertSchedule | null)?.alertConfig ??
            mergedSource.alertConfig ??
            DEFAULT_ALERT_SCHEDULE.alertConfig,
          status: (fullSchedule as AlertSchedule | null)?.status ?? mergedSource.status ?? 'ACTIVE',
        }
      : {
          ...DEFAULT_ALERT_SCHEDULE,
          name: generateDefaultScheduleName(),
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
    defaultValues: sanitizeFormDefaults(defaults),
  });

  useEffect(() => {
    // Reset fires on: dialog open, source row swap, mode change, OR
    // when the async full-schedule fetch settles. The last one is
    // critical - without it the form would render once with the
    // half-filled calendar row and never re-hydrate when the complete
    // schedule arrives a few hundred ms later.
    if (open) reset(sanitizeFormDefaults(defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?._id, mode, scheduleQuery.dataUpdatedAt]);

  // Diagnostic: when Zod rejects an edit-open the operator only sees the
  // generic "verifique os campos" toast from toastFirstError. Surface the
  // exact field + message in the console so an operator (or a dev pairing
  // in HML) can pinpoint which legacy field came in null/invalid without
  // a debugger session. Stays out of production bundles.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (Object.keys(errors).length === 0) return;
    // eslint-disable-next-line no-console
    console.warn(
      '[ScheduleFormDialog] resolver errors:',
      JSON.stringify(
        errors,
        (_key, value) => (value instanceof Error ? value.message : value),
        2,
      ),
    );
  }, [errors]);

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
        // Strip empty strings so backend doesn't try to cast `""` to
        // ObjectId (CastError) for optional refs like `account` when the
        // operator is not SUPER_ADMIN_MASTER. Preserves shape otherwise.
        const cleaned = stripEmpty(normalized);
        return alertsService.createSchedule(cleaned);
      }

      const scheduleId = resolveScheduleId(schedule);
      if (!scheduleId) throw new Error('MISSING_SCHEDULE_ID');

      if (mode === 'edit-occurrence') {
        const appointmentId = resolveAppointmentId(schedule);
        if (!appointmentId) throw new Error('MISSING_APPOINTMENT_ID');
        // Defensive: strip empty strings so optional ObjectId refs
        // (account/equipment) aren't cast-rejected by Mongoose.
        return alertsService.updateAppointmentOccurrence(
          stripEmpty({
            schedule: scheduleId,
            appointment: appointmentId,
            name: normalized.name,
            account: normalized.account,
            client: normalized.client,
            site: normalized.site,
            equipment: normalized.equipment,
            category: 'ALERT_CHECK' as const,
            beginDate: pinnedDay || normalized.beginDate,
            endDate: pinnedDay || normalized.endDate,
            beginHour: normalized.beginHour,
            endHour: normalized.endHour,
            alertConfig: normalized.alertConfig,
          }),
        );
      }

      // edit-series: scheduleId goes on `schedule` (NOT `_id`) because
      // ms-schedule's updateSchedule controller reads it from there.
      // Strip empty strings to avoid Mongoose CastError on empty refs.
      return alertsService.updateScheduleSeries(
        stripEmpty({
          ...normalized,
          schedule: scheduleId,
        }),
      );
    },
    onSuccess: (response: unknown) => {
      // Invalidate the calendar list, the events index, AND the
      // schedule-full cache for this id — without the third the next
      // edit-open within ~30s shows stale field values.
      queryClient.invalidateQueries({ queryKey: ['alert-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['alert-schedule-events'] });
      if (scheduleIdToFetch) {
        queryClient.invalidateQueries({ queryKey: ['schedule-full', scheduleIdToFetch] });
      }
      // Backend returns 200 with { firestoreWarning } when Mongo writes
      // succeeded but Firestore push failed. The schedule IS saved but
      // the device may not see the new occurrences until the next sync.
      const firestoreWarning =
        response && typeof response === 'object' && 'firestoreWarning' in response
          ? String((response as { firestoreWarning?: unknown }).firestoreWarning ?? '')
          : '';
      if (firestoreWarning) {
        toast.success(t('notifications.savedSuccessfully'));
        toast.warning(t('alerts.errors.firestorePushFailed'));
      } else {
        toast.success(t('notifications.savedSuccessfully'));
      }
      onOpenChange(false);
      reset(DEFAULT_ALERT_SCHEDULE);
      onSaved?.();
    },
    onError: (err: unknown) => {
      const code = (err as Error)?.message || 'UNKNOWN';
      if (code === 'MISSING_SCHEDULE_ID' || code === 'MISSING_APPOINTMENT_ID') {
        toast.error(t('alerts.errors.missingReference'));
        return;
      }
      // Surface the actual backend error (interceptor re-throws axios
      // errors with a useful response body) so an operator can act on
      // 400/404/500 instead of a generic toast.
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
      if (backendMessage) {
        toast.error(backendMessage);
      } else {
        toast.error(t('notifications.errorOccurred'));
      }
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

  // Track previous cascade values across renders. Using `let` here
  // would reinitialize from `defaults` on every render and break the
  // "value changed → reset children" comparison once the user edited
  // anything (defaults doesn't update mid-session).
  const prevAccountRef = useRef<string>(defaults.account ?? '');
  const prevClientRef = useRef<string>(defaults.client ?? '');
  const prevSiteRef = useRef<string>(defaults.site ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          {/* Account / Client / Site / Equipment cascade */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                        if (val !== prevAccountRef.current) {
                          setValue('client', '');
                          setValue('site', '');
                          setValue('equipment', '');
                          prevAccountRef.current = val;
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
                      if (val !== prevClientRef.current) {
                        setValue('site', '');
                        setValue('equipment', '');
                        prevClientRef.current = val;
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
                      if (val !== prevSiteRef.current) {
                        setValue('equipment', '');
                        prevSiteRef.current = val;
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
              {/*
                Equipment is intentionally NOT disabled in edit-occurrence
                mode. Operators must be able to swap the device for a single
                appointment when the physical hardware was replaced on-site.
                Backend (alertsService.updateAppointmentOccurrence) already
                accepts `equipment` in the payload — only the UI was locked.
                Account/client/site stay locked because the backend does
                not rebind appointment scope to a different hierarchy node.
              */}
              <Controller
                control={control}
                name="equipment"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
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

          <div className="my-2 h-px bg-white/10" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                        <SelectItem value="EVERY_OTHER_DAY">{t('alerts.everyOtherDay')}</SelectItem>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                            selected
                              ? 'bg-brand-600/20 border-brand-600/40 text-brand-400'
                              : 'text-text-secondary border-white/10 bg-white/5 hover:bg-white/10'
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
            <div className="max-w-[200px] space-y-2">
              <Label>{t('alerts.frequencyMonthDay')}</Label>
              <Input type="number" min={1} max={31} {...register('frequencyMonth.day')} />
            </div>
          )}

          {!isOccurrenceEdit && frequency === 'YEARLY' && (
            <div className="grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="my-2 h-px bg-white/10" />
          <h4 className="text-sm font-semibold text-white">{t('alerts.alertConfig')}</h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

          {/* Flavio (11/05): botão de excluir removido daqui — a exclusão
              agora vive no SchedulePreviewDialog (modal que abre ao clicar
              no agendamento no calendário). O prop onDeleteRequest fica
              declarado para preservar a API pública e não quebrar callers
              que ainda passam, mas não é mais renderizado. */}
          <DialogFooter>
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
