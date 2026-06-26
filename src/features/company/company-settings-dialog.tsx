'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Clock, Save } from 'lucide-react';
import { useAppForm } from '@/hooks/use-app-form';
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
import { Spinner } from '@/components/ui/spinner';
import { companyService } from '@/services/company.service';
import type { CompanySettings } from '@/types/api';
import {
  MONITOR_TIME_WINDOW_MAX_HOURS,
  MONITOR_TIME_WINDOW_MIN_HOURS,
  monitorSettingsSchema,
  type MonitorSettingsFormValues,
} from './schemas';

interface CompanySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * View + edit the per-account monitor event time-window.
 *
 * Loads the current settings via {@link companyService.getSettings} and
 * saves through {@link companyService.updateSettings}. The backend
 * `saveOrUpdate` requires a non-empty `monitor.eventFilters` array and
 * preserves the other monitor flags, so the PUT echoes back the loaded
 * `eventFilters` / `callRecordingEnabled` and only changes
 * `eventTimeWindowHours`. An empty input clears the window (system
 * default — eventos não são filtrados por idade).
 */
export function CompanySettingsDialog({ open, onOpenChange }: CompanySettingsDialogProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['company', 'settings', 'me'],
    queryFn: () => companyService.getSettings(),
    enabled: open,
    staleTime: 60 * 1000,
  });

  const settings = settingsQuery.data?.result;

  const form = useAppForm<MonitorSettingsFormValues>({
    resolver: zodResolver(monitorSettingsSchema),
    defaultValues: { eventTimeWindowHours: '' },
  });
  const { register, handleSubmit, reset, formState } = form;

  // Hydrate once the settings land (or the dialog reopens).
  useEffect(() => {
    if (!settings) return;
    const hours = settings.monitor?.eventTimeWindowHours;
    reset({ eventTimeWindowHours: hours != null ? String(hours) : '' });
  }, [settings, reset]);

  const mutation = useMutation({
    mutationFn: (values: MonitorSettingsFormValues) => {
      const current: CompanySettings | undefined = settings;
      // The backend derives account from the JWT and ignores the URL id; we
      // still send a stable identifier, preferring the immutable account FK.
      const targetId = current?.account ?? current?._id ?? '';
      const trimmed = values.eventTimeWindowHours.trim();
      const eventTimeWindowHours = trimmed === '' ? null : Number(trimmed);
      return companyService.updateSettings(targetId, {
        monitor: {
          eventFilters: current?.monitor?.eventFilters ?? [],
          callRecordingEnabled: current?.monitor?.callRecordingEnabled ?? false,
          eventTimeWindowHours,
        },
        status: current?.status ?? 'ACTIVE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', 'settings', 'me'] });
      toast.success(t('company.updateSuccess'));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('notifications.errorOccurred'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="text-brand-500 h-4 w-4" />
            {t('company.monitorSettings')}
          </DialogTitle>
          <DialogDescription>{t('company.eventTimeWindowHint')}</DialogDescription>
        </DialogHeader>

        {settingsQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eventTimeWindowHours">{t('company.eventTimeWindowHours')}</Label>
              <Input
                id="eventTimeWindowHours"
                type="number"
                inputMode="numeric"
                min={MONITOR_TIME_WINDOW_MIN_HOURS}
                max={MONITOR_TIME_WINDOW_MAX_HOURS}
                step={1}
                {...register('eventTimeWindowHours')}
              />
              {formState.errors.eventTimeWindowHours && (
                <p className="text-xs text-red-400">
                  {t(formState.errors.eventTimeWindowHours.message as string)}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={formState.isSubmitting || mutation.isPending}>
                <Save className="h-4 w-4" />
                {mutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
