'use client';

import { useForm, Controller } from 'react-hook-form';
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
import { alertScheduleSchema, type AlertScheduleFormValues, DEFAULT_ALERT_SCHEDULE } from './schemas';
import { alertsService } from '@/services/alerts.service';
import type { AlertSchedule } from '@/types/api';

interface ScheduleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: AlertSchedule;
}

export function ScheduleFormDialog({ open, onOpenChange, schedule }: ScheduleFormDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AlertScheduleFormValues>({
    resolver: zodResolver(alertScheduleSchema),
    defaultValues: schedule
      ? {
          ...DEFAULT_ALERT_SCHEDULE,
          ...schedule,
          account: typeof schedule.account === 'object' ? schedule.account?._id : schedule.account,
          client: typeof schedule.client === 'object' ? schedule.client?._id : schedule.client,
          site: typeof schedule.site === 'object' ? schedule.site?._id : schedule.site,
          equipment:
            typeof schedule.equipment === 'object' ? schedule.equipment?._id : schedule.equipment,
        }
      : DEFAULT_ALERT_SCHEDULE,
  });

  const alertType = watch('alertConfig.alertType');
  const frequency = watch('frequency');

  const mutation = useMutation({
    mutationFn: async (data: AlertScheduleFormValues) => {
      if (data._id) {
        return alertsService.updateSchedule(data);
      }
      return alertsService.createSchedule(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-schedules'] });
      toast.success(t('notifications.savedSuccessfully'));
      onOpenChange(false);
      reset();
    },
    onError: () => {
      toast.error(t('notifications.errorOccurred'));
    },
  });

  const onSubmit = (data: AlertScheduleFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {schedule ? t('alerts.editSchedule') : t('alerts.createSchedule')}
          </DialogTitle>
          <DialogDescription>
            {t('alerts.scheduling')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label>{t('alerts.scheduleName')}</Label>
              <Input {...register('name')} />
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">{t('alerts.daily')}</SelectItem>
                      <SelectItem value="WEEKLY">{t('alerts.weekly')}</SelectItem>
                      <SelectItem value="MONTHLY">{t('alerts.monthly')}</SelectItem>
                      <SelectItem value="YEARLY">{t('alerts.yearly')}</SelectItem>
                      <SelectItem value="ONCE">{t('alerts.once')}</SelectItem>
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
                  <Select value={field.value} onValueChange={field.onChange}>
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

            <div className="space-y-2">
              <Label>{t('alerts.beginDate')}</Label>
              <Input type="date" {...register('beginDate')} />
            </div>

            <div className="space-y-2">
              <Label>{t('alerts.endDate')}</Label>
              <Input type="date" {...register('endDate')} />
            </div>

            <div className="space-y-2">
              <Label>{t('alerts.beginHour')}</Label>
              <Input type="time" {...register('beginHour')} />
            </div>

            <div className="space-y-2">
              <Label>{t('alerts.endHour')}</Label>
              <Input type="time" {...register('endHour')} />
            </div>

            {frequency === 'WEEKLY' && (
              <div className="sm:col-span-2 space-y-2">
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

            <div className="sm:col-span-2 h-px bg-white/10 my-2" />

            <div className="space-y-2">
              <Label>{t('alerts.alertType')}</Label>
              <Controller
                control={control}
                name="alertConfig.alertType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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

            <div className="space-y-2">
              <Label>{t('alerts.volumeLevel')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                {...register('alertConfig.volumeLevel', { valueAsNumber: true })}
              />
            </div>

            {alertType === 'FIXED' && (
              <>
                <div className="space-y-2">
                  <Label>{t('alerts.fixedInterval')}</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register('alertConfig.fixedInterval', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('alerts.durationMin')}</Label>
                  <Input
                    type="number"
                    min={0}
                    {...register('alertConfig.durationMin', { valueAsNumber: true })}
                  />
                </div>
              </>
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
