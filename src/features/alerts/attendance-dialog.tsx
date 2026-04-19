'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { alertsService } from '@/services/alerts.service';
import { useAuth } from '@/hooks/use-auth';
import { translateDynamicLabel } from '@/lib/i18n-labels';
import type { PatrolAction } from '@/types/api';
import { cn } from '@/lib/utils';
import { classifyAttendance, extractAttendanceOwner } from './attendance-state';

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PatrolAction | null;
  /**
   * Called after attendance is closed (or one of the mutations toggles the
   * patrol-action state) so the parent list can refetch.
   */
  onChanged?: () => void;
}

/**
 * AttendanceDialog — mirrors shieldgo-admin-web's attendance flow:
 *   1. Opens the patrol-action attendance (status: IN_PROGRESS) if not yet.
 *   2. Operator logs one or more attendance records (type + notes).
 *   3. "Fechar atendimento" is enabled only once at least one record exists
 *      (either pre-existing or added in this session).
 *
 * The backend endpoints used are the same ones shieldgo-admin-web calls, so no
 * backend changes are required.
 */
export function AttendanceDialog({
  open,
  onOpenChange,
  event,
  onChanged,
}: AttendanceDialogProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const operatorId = user?._id ?? '';
  // Shieldgo only allows OPERATOR role to OPEN/CLOSE the attendance flag on a
  // patrol-action — other roles (ADMIN/MANAGER/AUDITOR) get a 401
  // `invalid.user.role`. Mirror that gate here so the dialog doesn't auto-fire
  // a request that will definitely fail.
  const isOperator = user?.companyUser?.subtype === 'OPERATOR';

  // siteGroup on the session user object may be a populated ref `{ _id }` or a
  // plain id string depending on how the server hydrated the login payload.
  // It's typed as `unknown` here because the canonical User type doesn't
  // currently declare it.
  const rawSiteGroup = (user as unknown as { siteGroup?: unknown })?.siteGroup;
  const siteGroup =
    rawSiteGroup && typeof rawSiteGroup === 'object' && rawSiteGroup !== null
      ? (rawSiteGroup as { _id?: string })._id
      : typeof rawSiteGroup === 'string'
        ? rawSiteGroup
        : undefined;

  const eventId = event?._id ?? null;

  // Shape helper: resolves id from either a populated object or raw string.
  const resolveId = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && '_id' in (value as object)) {
      return (value as { _id?: string })._id;
    }
    return undefined;
  };

  // ─── Load attendance types catalog + existing records ──────────
  const typesQuery = useQuery({
    queryKey: ['attendance-types'],
    queryFn: () => alertsService.getAttendanceTypes(),
    staleTime: 10 * 60 * 1000,
  });

  const recordsQuery = useQuery({
    queryKey: ['attendance-records', eventId],
    queryFn: () =>
      alertsService.filterAttendances({
        skip: 1,
        limit: 50,
        patrolAction: eventId ?? undefined,
        status: 'ACTIVE',
      }),
    enabled: !!open && !!eventId,
  });

  // The legacy API returns `results` (plural); alertsService.getAttendanceTypes
  // now normalizes to a bare array.
  const attendanceTypes = typesQuery.data ?? [];
  const records = recordsQuery.data?.results ?? [];

  // ── Ownership gate (critical for avoiding takeover) ─────────────
  // The backend `attendanceEvent` DAO uses `$set: { attendance: ... }` which
  // BLINDLY overwrites any existing attendance object — it's effectively a
  // takeover endpoint. The legacy shieldgo-admin-web guards against this in
  // the UI (only the operator who opened it may edit/close); we mirror that
  // contract here. See attendance-state.ts for the full lifecycle semantics.
  const state = classifyAttendance(event, operatorId || undefined);
  const owner = extractAttendanceOwner(event?.attendance);
  const ownerName = owner.name || t('alerts.attendance.anotherOperator');
  const isLocked = state === 'IN_PROGRESS_BY_OTHER';

  // ─── Form state (add new record) ───────────────────────────────
  const [type, setType] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (open) {
      // Reset the form each time the dialog reopens for a different event.
      setType('');
      setNotes('');
    }
  }, [open, eventId]);

  // ─── Mutations ─────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-records', eventId] });
    onChanged?.();
  };

  const openMutation = useMutation({
    mutationFn: () => {
      if (!eventId || !operatorId) throw new Error('missing.context');
      return alertsService.openAttendance({
        patrolActionId: eventId,
        operator: operatorId,
        siteGroup,
      });
    },
    onSuccess: () => {
      toast.success(t('alerts.attendance.openedToast'));
      invalidate();
    },
    onError: (err: unknown) => {
      // Backend rejects non-OPERATOR roles with 401 `invalid.user.role`. In
      // that specific case surface the dedicated copy so the operator
      // understands nothing was silently broken; our auto-open guard above
      // already prevents the API call from firing for non-operators, but keep
      // this belt-and-suspenders in case the role resolves late.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        toast.error(t('alerts.attendance.operatorOnly'));
        return;
      }
      toast.error(t('notifications.errorOccurred'));
    },
  });

  const addRecordMutation = useMutation({
    mutationFn: () => {
      if (!eventId || !operatorId || !event) throw new Error('missing.context');
      if (!type) throw new Error('missing.type');
      return alertsService.createAttendanceRecord({
        account: resolveId(event.account),
        client: resolveId(event.client),
        site: resolveId(event.site),
        event: resolveId(event.event) ?? eventId,
        patrolAction: eventId,
        type,
        notes: notes.trim() || undefined,
        operator: operatorId,
        siteGroup,
      });
    },
    onSuccess: () => {
      setType('');
      setNotes('');
      toast.success(t('alerts.attendance.recordAddedToast'));
      invalidate();
    },
    onError: (err) => {
      if ((err as Error).message === 'missing.type') {
        toast.error(t('alerts.attendance.typeRequired'));
        return;
      }
      toast.error(t('notifications.errorOccurred'));
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => {
      if (!eventId || !operatorId) throw new Error('missing.context');
      return alertsService.closeAttendance({
        patrolActionId: eventId,
        operator: operatorId,
        openedDate: event?.attendance?.openedDate,
        siteGroup,
      });
    },
    onSuccess: () => {
      toast.success(t('alerts.attendance.closedToast'));
      invalidate();
      onOpenChange(false);
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  // Auto-open the attendance flag when the dialog first appears for an
  // AVAILABLE event — saves the operator one click. Critical guards:
  //   • Only OPERATOR role may open/close (backend returns 401
  //     `invalid.user.role` otherwise).
  //   • Skip if the event is already claimed (by anyone) — opening would
  //     overwrite the owner's record via the DAO's `$set`. This is THE
  //     rule that prevents two operators from claiming the same event.
  //   • Skip if CLOSED — don't re-open a historical attendance.
  useEffect(() => {
    if (!open || !event || !operatorId) return;
    if (!isOperator) return;
    if (state !== 'AVAILABLE') return;
    if (openMutation.isPending || openMutation.isSuccess) return;
    openMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId, isOperator, state]);

  const canClose =
    records.length > 0 &&
    state === 'IN_PROGRESS_BY_ME' &&
    isOperator &&
    !closeMutation.isPending;
  const canAddRecord = state === 'IN_PROGRESS_BY_ME' && isOperator;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border border-white/10 bg-gradient-to-b from-bg-secondary to-bg-primary sm:rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 sm:px-8">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10 ring-1 ring-brand-500/20">
              <ShieldCheck className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">
                {t('alerts.attendance.dialogTitle')}
              </DialogTitle>
              <DialogDescription className="text-sm text-text-secondary">
                {t('alerts.attendance.dialogSubtitle')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 sm:px-8 space-y-5">
          {/* Status pill */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {state === 'AVAILABLE' && (
              <Badge variant="brand">
                {openMutation.isPending
                  ? t('common.loading')
                  : t('alerts.attendance.statusNotStarted')}
              </Badge>
            )}
            {state === 'IN_PROGRESS_BY_ME' && (
              <Badge variant="warning">
                {t('alerts.attendance.statusInProgressByYou')}
              </Badge>
            )}
            {state === 'IN_PROGRESS_BY_OTHER' && (
              <Badge variant="warning">
                {t('alerts.attendance.statusInProgressByOther', { name: ownerName })}
              </Badge>
            )}
            {state === 'CLOSED' && (
              <Badge variant="success">{t('alerts.attendance.statusClosedBadge')}</Badge>
            )}
            {event?.attendance?.openedDate && (
              <span className="text-text-muted">
                · {t('alerts.attendance.openedAt')}{' '}
                {new Date(event.attendance.openedDate).toLocaleString()}
              </span>
            )}
          </div>

          {/* Locked — another operator already claimed this event. Prevents
              the takeover that the backend's blind $set would allow. */}
          {isLocked && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{t('alerts.attendance.lockedDescription', { name: ownerName })}</span>
            </div>
          )}

          {/* Form: add a new record */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4 text-brand-400" />
              {t('alerts.attendance.addRecord')}
            </div>

            <div className="space-y-2">
              <Label>{t('alerts.attendance.recordType')}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder={t('alerts.attendance.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {typesQuery.isLoading && (
                    <SelectItem value="__loading" disabled>
                      {t('common.loading')}
                    </SelectItem>
                  )}
                  {!typesQuery.isLoading && attendanceTypes.length === 0 && (
                    <SelectItem value="__empty" disabled>
                      {t('common.noData')}
                    </SelectItem>
                  )}
                  {attendanceTypes.map((opt) => {
                    // Backend sends the enum _id (e.g. "CALL_CLIENT") which is
                    // the i18n key used across the legacy app. Fall back to
                    // the server-provided `name` and finally the humanized id.
                    const label =
                      translateDynamicLabel(opt._id, t, '') ||
                      translateDynamicLabel(opt.name, t, '') ||
                      opt.name ||
                      opt._id;
                    return (
                      <SelectItem key={opt._id} value={opt._id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('alerts.attendance.recordNotes')}</Label>
              <textarea
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-text-muted focus:border-brand-500/60 focus:outline-none"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('alerts.attendance.notesPlaceholder')}
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => addRecordMutation.mutate()}
                disabled={!type || addRecordMutation.isPending || !canAddRecord}
                title={
                  isLocked
                    ? t('alerts.attendance.lockedBy', { name: ownerName })
                    : undefined
                }
              >
                {addRecordMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t('alerts.attendance.saveRecord')}
              </Button>
            </div>
          </div>

          {/* List: existing records */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ClipboardList className="h-4 w-4 text-text-secondary" />
              {t('alerts.attendance.recordsTitle')}
              <span className="ml-auto text-xs font-normal text-text-muted">
                {records.length}
              </span>
            </div>

            {recordsQuery.isLoading ? (
              <div className="py-4 flex justify-center">
                <Spinner />
              </div>
            ) : records.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] px-4 py-6 text-center text-xs text-text-muted">
                {t('alerts.attendance.noRecordsHint')}
              </div>
            ) : (
              <ul className="space-y-2">
                {records.map((r) => {
                  // Same label resolution path as the Select options so the
                  // history and the picker stay visually consistent.
                  const typeName =
                    translateDynamicLabel(r.type, t, '') ||
                    translateDynamicLabel(
                      attendanceTypes.find((it) => it._id === r.type)?.name,
                      t,
                      '',
                    ) ||
                    r.type;
                  return (
                    <li
                      key={r._id}
                      className={cn(
                        'rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-sm',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="info">{typeName}</Badge>
                        <span className="text-xs text-text-muted">
                          {r.createDate
                            ? new Date(r.createDate).toLocaleString()
                            : ''}
                        </span>
                      </div>
                      {r.notes && (
                        <p className="mt-1.5 text-xs text-text-secondary whitespace-pre-wrap">
                          {r.notes}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Role gate notice — only OPERATORs can open/close attendance. */}
          {!isOperator && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{t('alerts.attendance.operatorOnly')}</span>
            </div>
          )}
          {/* Close attendance hint — only meaningful for the owner. */}
          {state === 'IN_PROGRESS_BY_ME' && isOperator && records.length === 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{t('alerts.attendance.mustAddRecord')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] bg-white/[0.02] px-6 py-4 sm:px-8">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            {t('common.close')}
          </Button>
          <Button
            type="button"
            onClick={() => closeMutation.mutate()}
            disabled={!canClose}
            title={!canClose && records.length === 0 ? t('alerts.attendance.mustAddRecord') : undefined}
          >
            {closeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {t('alerts.attendance.closeAttendance')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
