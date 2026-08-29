'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Calendar, CalendarRange, Clock, MapPin, Pencil, Trash, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { alertsService } from '@/services/alerts.service';
import type { AlertSchedule } from '@/types/api';

/**
 * Resolve o _id real do schedule. O row do calendário pode estar em
 * appointment-shape (ref `schedule` para o doc pai) ou em schedule-shape
 * (já é o doc pai). O endpoint `getScheduleById` precisa do _id do
 * SCHEDULE, não do appointment — daí esse passo.
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

/**
 * Pega os 4 últimos caracteres do identificador do equipamento. Aceita
 * tanto o id raw (string) quanto o objeto populated com `_id`/`code`/
 * `equipmentNumber`. Retorna '' se não houver nada útil.
 */
function extractEquipmentLastFour(value: unknown): string {
  const pickFromString = (s: string): string => {
    const trimmed = s.trim();
    if (!trimmed) return '';
    return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
  };
  if (!value) return '';
  if (typeof value === 'string') return pickFromString(value);
  if (typeof value === 'object') {
    const obj = value as { code?: unknown; equipmentNumber?: unknown; _id?: unknown };
    if (typeof obj.code === 'string' && obj.code.trim()) return pickFromString(obj.code);
    if (typeof obj.equipmentNumber === 'string' && obj.equipmentNumber.trim()) {
      return pickFromString(obj.equipmentNumber);
    }
    if (typeof obj._id === 'string' && obj._id.trim()) return pickFromString(obj._id);
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
      <div className="min-w-0 flex-1">
        <div className="text-text-muted text-[11px] font-medium tracking-wide uppercase">
          {label}
        </div>
        <div className="text-text-primary mt-0.5 text-sm font-medium break-words">{children}</div>
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
          ? 'flex h-20 min-h-20 w-full items-start justify-start border border-red-500/30 bg-red-500/10 px-4 py-3 text-left whitespace-normal text-red-400 hover:bg-red-500/20'
          : 'flex h-20 min-h-20 w-full items-start justify-start px-4 py-3 text-left whitespace-normal'
      }
    >
      <span className="mt-0.5 mr-3 flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 overflow-hidden">
        <span className="line-clamp-1 w-full text-sm leading-tight font-semibold">{title}</span>
        <span className="line-clamp-2 w-full text-[11px] leading-tight font-normal opacity-80">
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
  const confirmationKey = open ? schedule?._id || resolveScheduleId(schedule) : '';
  const [confirmation, setConfirmation] = useState<{
    key: string;
    pending: 'occurrence' | 'series' | null;
  }>({ key: confirmationKey, pending: null });

  // React permits guarded state adjustment during render when state is
  // derived from a changed prop. Keeping the schedule/open identity beside
  // the confirmation preserves the fresh-slate behavior without an Effect.
  if (confirmation.key !== confirmationKey) {
    setConfirmation({ key: confirmationKey, pending: null });
  }
  const pendingConfirm = confirmation.key === confirmationKey ? confirmation.pending : null;

  // Fetch the FULL schedule doc by _id. O row vindo do calendário pode
  // estar em appointment-shape com refs site/equipment/client NÃO
  // populadas (só IDs). O endpoint /schedules/v1/{id} retorna o doc
  // completo com refs populadas — mesmo padrão usado pelo form-dialog.
  // Sem isso o operador não vê o nome do site nem o equipamento.
  const scheduleIdToFetch = resolveScheduleId(schedule);
  const fullScheduleQuery = useQuery({
    queryKey: ['schedule-full', scheduleIdToFetch],
    queryFn: () => alertsService.getScheduleById(scheduleIdToFetch),
    enabled: open && !!scheduleIdToFetch,
    staleTime: 60_000,
  });
  const fullSchedule = fullScheduleQuery.data ?? null;
  const isLoadingFull = open && !!scheduleIdToFetch && fullScheduleQuery.isLoading;

  // Merge calendar row + full schedule. Full doc wins for series-wide
  // fields (name, dates, refs populadas, hours canônicas); row do
  // calendário ainda contribui appointment-specific (start) que não
  // existe no schedule. Cast preservado — type ainda é AlertSchedule.
  const merged = useMemo<AlertSchedule | undefined>(() => {
    if (!schedule && !fullSchedule) return undefined;
    if (!fullSchedule) return schedule;
    return { ...(schedule ?? {}), ...fullSchedule } as AlertSchedule;
  }, [schedule, fullSchedule]);

  const name = useMemo(() => extractScheduleName(merged), [merged]);
  const formattedDate = useMemo(() => formatDate(occurrenceDate, locale), [occurrenceDate, locale]);
  const beginHour = formatHour(merged?.beginHour);
  const endHour = formatHour(merged?.endHour);

  // Período da SÉRIE (data início → data fim do agendamento), independente
  // do dia clicado. Flavio (09/05): o preview deve mostrar o range do
  // agendamento, não só o dia da ocorrência.
  const beginDateStr = merged?.beginDate ? merged.beginDate.slice(0, 10) : '';
  const endDateStr = merged?.endDate ? merged.endDate.slice(0, 10) : '';
  const formattedBeginDate = useMemo(
    () => formatDate(beginDateStr, locale),
    [beginDateStr, locale],
  );
  const formattedEndDate = useMemo(
    () => (endDateStr ? formatDate(endDateStr, locale) : ''),
    [endDateStr, locale],
  );

  const siteName = extractCompanyName(merged?.site);
  const equipmentLastFour = extractEquipmentLastFour(merged?.equipment);
  // "Local" = nome do site + últimos 4 dígitos do equipamento. Ex.: "Sede SP • 9F2A"
  // Cai pra '—' se nada útil.
  const localLabel = (() => {
    const parts: string[] = [];
    if (siteName) parts.push(siteName);
    if (equipmentLastFour) parts.push(equipmentLastFour);
    return parts.length ? parts.join(' • ') : '—';
  })();

  const handleDeleteClick = (scope: 'occurrence' | 'series') => {
    if (pendingConfirm !== scope) {
      setConfirmation({ key: confirmationKey, pending: scope });
      return;
    }
    if (scope === 'occurrence') onDeleteOccurrence();
    else onDeleteSeries();
  };

  const cancelConfirm = () => setConfirmation({ key: confirmationKey, pending: null });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(e) => {
          if (isDeleting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base">{name || t('alerts.preview.title')}</DialogTitle>
          <DialogDescription>{t('alerts.preview.title')}</DialogDescription>
        </DialogHeader>

        {/* Context block — Flavio (09/05): mostrar APENAS o essencial pro
            operador entender o que vai mexer: período, horário e local.
            Frequência/tipo/status removidos para reduzir ruído. */}
        {isLoadingFull ? (
          <div className="bg-bg-tertiary flex items-center justify-center gap-3 rounded-xl p-6">
            <Spinner size="sm" />
            <span className="text-text-secondary text-sm">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="bg-bg-tertiary space-y-3 rounded-xl p-4">
            <FieldRow
              icon={<Calendar className="h-4 w-4" />}
              label={t('alerts.preview.fields.period')}
            >
              <span>
                {formattedBeginDate}
                {formattedEndDate ? ` – ${formattedEndDate}` : ''}
              </span>
            </FieldRow>

            <FieldRow
              icon={<Clock className="h-4 w-4" />}
              label={t('alerts.preview.fields.timeWindow')}
            >
              <span>
                {beginHour} – {endHour}
              </span>
            </FieldRow>

            <FieldRow
              icon={<MapPin className="h-4 w-4" />}
              label={t('alerts.preview.fields.location')}
            >
              {localLabel}
            </FieldRow>
          </div>
        )}

        {/* Action grid — 2x2 on sm+, stacked on mobile. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            <div className="col-span-1 flex h-20 flex-col justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
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
            <div className="col-span-1 flex flex-col gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
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
