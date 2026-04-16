'use client';

import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import type { AlertSchedule } from '@/types/api';
import {
  useAccountsLookup,
  useClientsLookup,
  useSitesLookup,
  useEquipmentsBySiteLookup,
} from '@/features/shared/use-hierarchy-lookups';
import { isSuperAdminMaster } from '@/config/roles';
import { useAuth } from '@/hooks/use-auth';

interface ScheduleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: AlertSchedule;
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

export function ScheduleFormDialog({ open, onOpenChange, schedule }: ScheduleFormDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { userSubtype, user: sessionUser } = useAuth();
  const isEdit = !!schedule?._id;
  const canSelectAccount = isSuperAdminMaster(userSubtype);
  const sessionAccountId =
    typeof sessionUser?.account === 'object' ? sessionUser.account?._id : undefined;

  const defaults: AlertScheduleFormValues = schedule
    ? {
        ...DEFAULT_ALERT_SCHEDULE,
        ...schedule,
        account: getIdOrEmpty(schedule.account) || (canSelectAccount ? '' : sessionAccountId || ''),
        client: getIdOrEmpty(schedule.client),
        site: getIdOrEmpty(schedule.site),
        equipment: getIdOrEmpty(schedule.equipment),
        endDate: schedule.endDate || '',
        weeklyDays: schedule.weeklyDays ?? [],
        frequencyMonth: schedule.frequencyMonth ?? { day: '' },
        frequencyYear: schedule.frequencyYear ?? { month: '', day: '' },
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
  } = useForm<AlertScheduleFormValues>({
    resolver: zodResolver(alertScheduleSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?._id]);

  const accountWatched = useWatch({ control, name: 'account' });
  const clientWatched = useWatch({ control, name: 'client' });
  const siteWatched = useWatch({ control, name: 'site' });
  const frequency = useWatch({ control, name: 'frequency' });
  const alertType = useWatch({ control, name: 'alertConfig.alertType' });

  const accountsLookup = useAccountsLookup();
  const clientsLookup = useClientsLookup(accountWatched || undefined);
  const sitesLookup = useSitesLookup(clientWatched || undefined);
  const equipmentsLookup = useEquipmentsBySiteLookup({
    account: accountWatched || undefined,
    client: clientWatched || undefined,
    site: siteWatched || undefined,
  });

  const mutation = useMutation({
    mutationFn: async (data: AlertScheduleFormValues) => {
      // Coerce string numbers from month/day back to numbers for the backend
      const payload: AlertScheduleFormValues = {
        ...data,
        frequencyMonth: data.frequencyMonth
          ? { day: data.frequencyMonth.day ?? '' }
          : { day: '' },
        frequencyYear: data.frequencyYear
          ? {
              month: data.frequencyYear.month ?? '',
              day: data.frequencyYear.day ?? '',
            }
          : { month: '', day: '' },
      };
      if (isEdit && schedule?._id) {
        return alertsService.updateSchedule(payload);
      }
      return alertsService.createSchedule(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-schedules'] });
      toast.success(t('notifications.savedSuccessfully'));
      onOpenChange(false);
      reset(DEFAULT_ALERT_SCHEDULE);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  // Track previous values for cascade reset
  let prevAccount = defaults.account ?? '';
  let prevClient = defaults.client ?? '';
  let prevSite = defaults.site ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('alerts.editSchedule') : t('alerts.createSchedule')}
          </DialogTitle>
          <DialogDescription>{t('alerts.scheduling')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          {/* Account / Client / Site cascade */}
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
                      disabled={isEdit}
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
                    disabled={isEdit}
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
                    disabled={isEdit}
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

          <div className="h-px bg-white/10 my-2" />

          {/* Name / Frequency / Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-3">
              <Label>{t('alerts.scheduleName')}</Label>
              <Input {...register('name')} disabled={isEdit} />
              {errors.name && (
                <p className="text-xs text-red-400">{t(errors.name.message as string)}</p>
              )}
            </div>

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
                      // Reset frequency-specific fields on change
                      setValue('weeklyDays', []);
                      setValue('frequencyMonth', { day: '' });
                      setValue('frequencyYear', { month: '', day: '' });
                    }}
                    disabled={isEdit}
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

            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value ?? 'ACTIVE'} onValueChange={field.onChange}>
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

          {/* Dates & hours */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('alerts.beginDate')}</Label>
              <Input type="date" {...register('beginDate')} disabled={isEdit} />
            </div>
            <div className="space-y-2">
              <Label>{t('alerts.endDate')}</Label>
              <Input type="date" {...register('endDate')} disabled={isEdit} />
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

          {/* Weekly days */}
          {frequency === 'WEEKLY' && (
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

          {/* Monthly day */}
          {frequency === 'MONTHLY' && (
            <div className="space-y-2 max-w-[200px]">
              <Label>{t('alerts.frequencyMonthDay')}</Label>
              <Input
                type="number"
                min={1}
                max={31}
                {...register('frequencyMonth.day')}
              />
            </div>
          )}

          {/* Yearly month + day */}
          {frequency === 'YEARLY' && (
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
                <Input
                  type="number"
                  min={1}
                  max={31}
                  {...register('frequencyYear.day')}
                />
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

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
