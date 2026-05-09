'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bell,
  Calendar,
  CalendarRange,
  CircleDot,
  Clock,
  MapPin,
  Pencil,
  Repeat,
  Trash,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AlertSchedule, ScheduleFrequency } from '@/types/api';

const WEEKDAY_KEYS = [
  'alerts.sunday',
  'alerts.monday',
  'alerts.tuesday',
  'alerts.wednesday',
  'alerts.thursday',
  'alerts.friday',
  'alerts.saturday',
] as const;

const FREQUENCY_KEY: Record<ScheduleFrequency, string> = {
  NOT_REPEAT: 'alerts.preview.frequency.NOT_REPEAT',
  DAILY: 'alerts.preview.frequency.DAILY',
  EVERY_OTHER_DAY: 'alerts.preview.frequency.EVERY_OTHER_DAY',
  WEEKLY: 'alerts.preview.frequency.WEEKLY',
  MONTHLY: 'alerts.preview.frequency.MONTHLY',
  YEARLY: 'alerts.preview.frequency.YEARLY',
};

const STATUS_KEY: Record<string, string> = {
  ACTIVE: 'alerts.preview.status.ACTIVE',
  ARCHIVED: 'alerts.preview.status.ARCHIVED',
};

interface SchedulePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: AlertSchedule;
  /** YYYY-MM-DD of the clicked occurrence. */
  occurrenceDate?: string;
  onEditOccurrence: () => void;
  onEditSeries: () => void;
  onDeleteOccurrence: () => void;
  onDeleteSeries: () => void;
  isDeleting?: boolean;
}

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

function extractCompanyName(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return '';
  if (typeof value === 'object' && 'name' in value) {
    const n = (value as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim()) return n;
  }
  return '';
}

function formatHour(raw: string | undefined): string {
  if (!raw) return '--:--';
  if (raw.length <= 5) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  // Schedule hours stored as UTC — display as-is (mirrors form-dialog logic).
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function mapDateLocale(locale: string): string {
  const base = (locale || 'pt').split('-')[0].toLowerCase();
  if (base === 'pt') return 'pt-BR';
  if (base === 'es') return 'es-ES';
  if (base === 'ja') return 'ja-JP';
  if (base === 'zh') return 'zh-CN';
  return 'en-US';
}

function formatDate(occurrenceDate: string | undefined, locale: string): string {
  if (!occurrenceDate) return '—';
  // Parse YYYY-MM-DD as local date so timezone offset doesn't shift the day.
  const [y, m, d] = occurrenceDate.split('-').map(Number);
  if (!y || !m || !d) return occurrenceDate;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return occurrenceDate;
  return new Intl.DateTimeFormat(mapDateLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function FieldRow({ icon, label, children }: FieldRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-text-muted mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-text-muted text-[11px] uppercase tracking-wide font-medium">
          {label}
        </div>
        <div className="text-text-primary text-sm font-medium mt-0.5 break-words">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  variant: 'secondary' | 'default' | 'outline' | 'destructive';
  destructive?: boolean;
  describedById?: string;
  disabled?: boolean;
}

function ActionCard({
  icon,
  title,
  hint,
  onClick,
  variant,
  destructive,
  describedById,
  disabled,
}: ActionCardProps) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describedById}
      className={
        destructive
          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 h-auto justify-start py-3 px-4 text-left'
          : 'h-auto justify-start py-3 px-4 text-left'
      }
    >
      <span className="mr-3 flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="flex flex-col items-start gap-0.5">
        <span className="text-sm font-semibold leading-tight">{title}</span>
        <span className="text-[11px] font-normal opacity-80 leading-tight">
          {hint}
        </span>
      </span>
    </Button>
  );
}

/**
 * Schedule preview dialog — entry point when the operator clicks a calendar
 * event. Surfaces the full context of the appointment (when, where, type,
 * status) and exposes 4 scoped actions in a single screen instead of the old
 * two-step modal flow (scope picker → form/delete).
 *
 * Destructive actions ask for inline confirmation (no nested modal) to keep
 * the operator one click away from undoing.
 */
export function SchedulePreviewDialog({
  open,
  onOpenChange,
  schedule,
  occurrenceDate,
  onEditOccurrence,
  onEditSeries,
  onDeleteOccurrence,
  onDeleteSeries,
  isDeleting = false,
}: SchedulePreviewDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [pendingConfirm, setPendingConfirm] = useState<
    'occurrence' | 'series' | null
  >(null);

  // Reset the inline confirmation whenever the dialog reopens or the
  // schedule changes — operators expect a fresh slate every click.
  useEffect(() => {
    if (!open) setPendingConfirm(null);
  }, [open, schedule?._id]);

  const name = useMemo(() => extractScheduleName(schedule), [schedule]);
  const formattedDate = useMemo(
    () => formatDate(occurrenceDate, locale),
    [occurrenceDate, locale],
  );
  const beginHour = formatHour(schedule?.beginHour);
  const endHour = formatHour(schedule?.endHour);

  const frequencyLabel = (() => {
    if (!schedule) return '—';
    const key = FREQUENCY_KEY[schedule.frequency];
    return key ? t(key) : schedule.frequency;
  })();

  const weeklyDaysLabel = (() => {
    if (!schedule || schedule.frequency !== 'WEEKLY') return '';
    const days = schedule.weeklyDays ?? [];
    if (!days.length) return '';
    return days
      .map((d) => {
        const idx = ((d % 7) + 7) % 7;
        return t(WEEKDAY_KEYS[idx]);
      })
      .join(', ');
  })();

  const siteName = extractCompanyName(schedule?.site);
  const clientName = extractCompanyName(schedule?.client);
  const hierarchyLabel = (() => {
    const parts = [siteName, clientName].filter(Boolean);
    return parts.length ? parts.join(' • ') : '—';
  })();

  const alertTypeLabel = (() => {
    if (!schedule?.alertConfig) return '—';
    const type = schedule.alertConfig.alertType;
    const typeText = type === 'FIXED' ? t('alerts.fixed') : t('alerts.random');
    if (type === 'FIXED' && schedule.alertConfig.fixedInterval) {
      return `${typeText} • ${schedule.alertConfig.fixedInterval} min`;
    }
    if (type === 'RANDOM') {
      const min = schedule.alertConfig.randomMin;
      const max = schedule.alertConfig.randomMax;
      if (min && max) return `${typeText} • ${min}–${max} min`;
    }
    return typeText;
  })();

  const statusVariant: 'success' | 'muted' = (() => {
    if (!schedule) return 'muted';
    if (schedule.status === 'ACTIVE') return 'success';
    return 'muted';
  })();

  const statusLabel = (() => {
    if (!schedule) return '—';
    const key = STATUS_KEY[schedule.status as string];
    return key ? t(key) : schedule.status;
  })();

  const handleDeleteClick = (scope: 'occurrence' | 'series') => {
    if (pendingConfirm !== scope) {
      setPendingConfirm(scope);
      return;
    }
    if (scope === 'occurrence') onDeleteOccurrence();
    else onDeleteSeries();
  };

  const cancelConfirm = () => setPendingConfirm(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(e) => {
          if (isDeleting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base">
            {name || t('alerts.preview.title')}
          </DialogTitle>
          <DialogDescription>{t('alerts.preview.title')}</DialogDescription>
        </DialogHeader>

        {/* Context block — gives the operator full awareness of WHAT they're
            about to act on before they pick a scope. */}
        <div className="bg-bg-tertiary rounded-xl p-4 space-y-3">
          <FieldRow
            icon={<Calendar className="h-4 w-4" />}
            label={t('alerts.preview.fields.dateTime')}
          >
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{formattedDate}</span>
              <span className="text-text-muted">•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-text-muted" />
                {beginHour} – {endHour}
              </span>
            </span>
          </FieldRow>

          <FieldRow
            icon={<Repeat className="h-4 w-4" />}
            label={t('alerts.preview.fields.frequency')}
          >
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{frequencyLabel}</Badge>
              {weeklyDaysLabel ? (
                <span className="text-text-secondary text-xs">
                  {weeklyDaysLabel}
                </span>
              ) : null}
            </span>
          </FieldRow>

          <FieldRow
            icon={<MapPin className="h-4 w-4" />}
            label={t('alerts.preview.fields.hierarchy')}
          >
            {hierarchyLabel}
          </FieldRow>

          <FieldRow
            icon={<Bell className="h-4 w-4" />}
            label={t('alerts.preview.fields.alertType')}
          >
            {alertTypeLabel}
          </FieldRow>

          <FieldRow
            icon={<CircleDot className="h-4 w-4" />}
            label={t('alerts.preview.fields.status')}
          >
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </FieldRow>
        </div>

        {/* Action grid — 2x2 on sm+, stacked on mobile. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ActionCard
            icon={<Pencil className="h-4 w-4" />}
            title={t('alerts.preview.actions.editOccurrence.title')}
            hint={t('alerts.preview.actions.editOccurrence.hint', {
              date: formattedDate,
            })}
            onClick={onEditOccurrence}
            variant="secondary"
            disabled={isDeleting}
          />
          <ActionCard
            icon={<CalendarRange className="h-4 w-4" />}
            title={t('alerts.preview.actions.editSeries.title')}
            hint={t('alerts.preview.actions.editSeries.hint')}
            onClick={onEditSeries}
            variant="default"
            disabled={isDeleting}
          />

          {/* Delete-occurrence — confirmation inline */}
          {pendingConfirm === 'occurrence' ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 flex flex-col gap-2 col-span-1">
              <span className="text-text-primary text-xs font-semibold">
                {t('alerts.preview.confirm.title')}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelConfirm}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  {t('alerts.preview.confirm.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick('occurrence')}
                  disabled={isDeleting}
                  className="flex-1"
                  aria-describedby="preview-delete-occ-hint"
                >
                  {t('alerts.preview.confirm.confirm')}
                </Button>
              </div>
            </div>
          ) : (
            <ActionCard
              icon={<Trash2 className="h-4 w-4" />}
              title={t('alerts.preview.actions.deleteOccurrence.title')}
              hint={t('alerts.preview.actions.deleteOccurrence.hint', {
                date: formattedDate,
              })}
              onClick={() => handleDeleteClick('occurrence')}
              variant="outline"
              disabled={isDeleting}
              describedById="preview-delete-occ-hint"
            />
          )}

          {/* Delete-series — destructive emphasis */}
          {pendingConfirm === 'series' ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 flex flex-col gap-2 col-span-1">
              <span className="text-text-primary text-xs font-semibold">
                {t('alerts.preview.confirm.title')}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelConfirm}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  {t('alerts.preview.confirm.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick('series')}
                  disabled={isDeleting}
                  className="flex-1"
                  aria-describedby="preview-delete-series-hint"
                >
                  {t('alerts.preview.confirm.confirm')}
                </Button>
              </div>
            </div>
          ) : (
            <ActionCard
              icon={<Trash className="h-4 w-4" />}
              title={t('alerts.preview.actions.deleteSeries.title')}
              hint={t('alerts.preview.actions.deleteSeries.hint')}
              onClick={() => handleDeleteClick('series')}
              variant="outline"
              destructive
              disabled={isDeleting}
              describedById="preview-delete-series-hint"
            />
          )}
        </div>

        {/* Hidden hints for aria-describedby on destructive actions. */}
        <span id="preview-delete-occ-hint" className="sr-only">
          {t('alerts.preview.actions.deleteOccurrence.hint', {
            date: formattedDate,
          })}
        </span>
        <span id="preview-delete-series-hint" className="sr-only">
          {t('alerts.preview.actions.deleteSeries.hint')}
        </span>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            <X className="h-4 w-4" />
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
