'use client';

import { useTranslations } from 'next-intl';
import { CalendarRange, CalendarDays, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type ScheduleScope = 'series' | 'occurrence';
export type ScheduleScopeAction = 'edit' | 'delete';

interface ScheduleScopeDialogProps {
  open: boolean;
  action: ScheduleScopeAction;
  eventLabel?: string;
  onChoose: (scope: ScheduleScope) => void;
  onCancel: () => void;
  /** Disables both scope buttons while the parent is committing a mutation. */
  isWorking?: boolean;
}

/**
 * Small modal that asks the operator whether to act on just this day's
 * occurrence or the whole recurring series. Mirrors the shieldgo-admin-web
 * AlertOccurrence flow (SweetAlert with three buttons) but using the
 * project's Dialog primitives so we stay inside the design system.
 *
 * The parent owns the "what happens next" logic — this component is pure:
 * it renders the choice and delegates via `onChoose` / `onCancel`.
 */
export function ScheduleScopeDialog({
  open,
  action,
  eventLabel,
  onChoose,
  onCancel,
  isWorking = false,
}: ScheduleScopeDialogProps) {
  const t = useTranslations();

  const titleKey =
    action === 'edit' ? 'alerts.scope.editTitle' : 'alerts.scope.deleteTitle';
  const descriptionKey =
    action === 'edit'
      ? 'alerts.scope.editDescription'
      : 'alerts.scope.deleteDescription';
  const occurrenceLabelKey =
    action === 'edit' ? 'alerts.scope.editOccurrence' : 'alerts.scope.deleteOccurrence';
  const seriesLabelKey =
    action === 'edit' ? 'alerts.scope.editSeries' : 'alerts.scope.deleteSeries';

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>
            {t(descriptionKey)}
            {eventLabel ? <span className="block mt-1 text-text-muted">{eventLabel}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            className="justify-start h-auto py-3"
            disabled={isWorking}
            onClick={() => onChoose('occurrence')}
          >
            <CalendarDays className="h-4 w-4 mr-2 text-brand-400" />
            <span className="flex flex-col items-start text-left">
              <span className="font-semibold">{t(occurrenceLabelKey)}</span>
              <span className="text-xs text-text-muted">
                {t('alerts.scope.occurrenceHint')}
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant={action === 'delete' ? 'destructive' : 'default'}
            className="justify-start h-auto py-3"
            disabled={isWorking}
            onClick={() => onChoose('series')}
          >
            <CalendarRange className="h-4 w-4 mr-2" />
            <span className="flex flex-col items-start text-left">
              <span className="font-semibold">{t(seriesLabelKey)}</span>
              <span className="text-xs opacity-80">{t('alerts.scope.seriesHint')}</span>
            </span>
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isWorking}>
            <X className="h-4 w-4" />
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
