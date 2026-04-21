'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Circle, FileText, Lock, MapPin, Phone, Radio, Router, ShieldCheck, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EventType, PatrolAction } from '@/types/api';
import { formatDeviceLabel, resolveCallTargetId } from './device-label';
import {
  classifyAttendance,
  extractAttendanceOwner,
  type AttendanceState,
} from './attendance-state';

const EVENT_META: Record<
  EventType,
  { labelKey: string; accent: 'danger' | 'warning' | 'info' | 'brand' }
> = {
  SOS_ALERT: { labelKey: 'alerts.sosAlert', accent: 'danger' },
  INCIDENT: { labelKey: 'alerts.incident', accent: 'warning' },
  CRASH: { labelKey: 'alerts.crash', accent: 'danger' },
  LOWVOLTAGE: { labelKey: 'alerts.lowVoltage', accent: 'warning' },
  CANCEL_PATROL: { labelKey: 'alerts.cancelPatrol', accent: 'info' },
  FAILURE_PATROL: { labelKey: 'alerts.failurePatrol', accent: 'warning' },
};

interface Props {
  event: PatrolAction;
  /** ID of the logged-in operator. Required to decide ownership states. */
  currentUserId: string | undefined;
  /** True when the logged-in user has the OPERATOR role (others can't open attendance). */
  isOperator: boolean;
  onAttend: (event: PatrolAction) => void;
  onCall: (event: PatrolAction, mode: 'NORMAL' | 'SILENT_LISTEN') => void;
  callInProgress: boolean;
  socketConnected: boolean;
  /** Highlight the card briefly after it arrived/updated via real-time. */
  flash?: boolean;
}

/**
 * Single event row on the monitor. Isolates render cost to one row via
 * React.memo + stable callback references from the parent.
 *
 * The visual distinction between "disponível para atendimento" (fresh),
 * "em andamento por fulano" (claimed by another operator - locked for
 * the current user), "em andamento por você" and "encerrado" is driven
 * entirely by {@link classifyAttendance} so every surface tells the
 * same story.
 */
function MonitorEventCardImpl({
  event,
  currentUserId,
  isOperator,
  onAttend,
  onCall,
  callInProgress,
  socketConnected,
  flash,
}: Props) {
  const t = useTranslations();
  const meta = EVENT_META[event.type] ?? { labelKey: 'common.info', accent: 'info' as const };
  const hasCallTarget = !!resolveCallTargetId(event);
  const canCall = !callInProgress && socketConnected && hasCallTarget;
  const state = classifyAttendance(event, currentUserId);
  const owner = extractAttendanceOwner(event.attendance);
  const ownerName = owner.name || t('alerts.attendance.anotherOperator');
  const deviceLabel = formatDeviceLabel(event);

  // Extra signals surfaced in the card body when present. Rendered as a
  // secondary line below the timestamp so the scan order stays:
  //   TYPE → DEVICE → TIME → metadata.
  // Operator only shows in IN_PROGRESS_BY_ME so it doesn't duplicate the
  // IN_PROGRESS_BY_OTHER lock already rendered above.
  const equipmentName =
    typeof event.equipment === 'object' && event.equipment
      ? (event.equipment as { name?: string }).name || null
      : null;
  const notesSnippet = event.notes ? event.notes.trim().slice(0, 140) : '';
  const ownerLineName = state === 'IN_PROGRESS_BY_ME' ? owner.name : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-white/8 p-4 transition-all',
        meta.accent === 'danger' && 'bg-red-500/5 border-red-500/20',
        meta.accent === 'warning' && 'bg-amber-500/5 border-amber-500/20',
        // Fresh events get a calm breathing outline so the operator's eye
        // is drawn to actionable items without the noise of a full pulse
        // animation on every card.
        state === 'AVAILABLE' && 'ring-1 ring-emerald-500/30',
        state === 'IN_PROGRESS_BY_OTHER' && 'opacity-90',
        flash && 'ring-2 ring-brand-500/60 ring-offset-2 ring-offset-background animate-pulse',
      )}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              meta.accent === 'danger' && 'bg-red-500/20 text-red-400',
              meta.accent === 'warning' && 'bg-amber-500/20 text-amber-400',
              meta.accent === 'info' && 'bg-blue-500/20 text-blue-400',
              meta.accent === 'brand' && 'bg-brand-600/20 text-brand-400',
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={meta.accent}>{t(meta.labelKey)}</Badge>
              <AttendanceStateBadge state={state} ownerName={ownerName} />
            </div>
            <p className="text-sm font-medium text-white mt-1 truncate">{deviceLabel}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {(event.date || event.createdDate) &&
                new Date(event.date || event.createdDate!).toLocaleString()}
              {event.location && (
                <>
                  {' · '}
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.location.lat.toFixed(4)}, {event.location.lng.toFixed(4)}
                  </span>
                </>
              )}
              {state === 'IN_PROGRESS_BY_OTHER' && (
                <>
                  {' · '}
                  <span className="inline-flex items-center gap-1 text-amber-300/80">
                    <Lock className="h-3 w-3" />
                    {t('alerts.attendance.lockedBy', { name: ownerName })}
                  </span>
                </>
              )}
            </p>
            {(equipmentName || ownerLineName) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                {equipmentName && (
                  <span className="inline-flex items-center gap-1">
                    <Router className="h-3 w-3" />
                    {equipmentName}
                  </span>
                )}
                {ownerLineName && (
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-3 w-3" />
                    {ownerLineName}
                  </span>
                )}
              </p>
            )}
            {notesSnippet && (
              <p className="mt-1 flex items-start gap-1 text-xs text-text-secondary/90">
                <FileText className="h-3 w-3 mt-0.5 shrink-0 text-text-muted" />
                <span className="line-clamp-2">{notesSnippet}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <AttendanceActionButton
            state={state}
            ownerName={ownerName}
            isOperator={isOperator}
            onClick={() => onAttend(event)}
          />

          <Button
            size="sm"
            variant="secondary"
            onClick={() => onCall(event, 'NORMAL')}
            disabled={!canCall}
            title={
              !socketConnected
                ? t('calls.chatDisconnected')
                : !hasCallTarget
                  ? t('calls.noTarget')
                  : undefined
            }
          >
            <Phone className="h-4 w-4" />
            {t('calls.callNormal')}
          </Button>
          {event.type === 'SOS_ALERT' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onCall(event, 'SILENT_LISTEN')}
              disabled={!canCall}
              title={!hasCallTarget ? t('calls.noTarget') : undefined}
            >
              <Radio className="h-4 w-4" />
              {t('calls.silentListen')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttendanceStateBadge({
  state,
  ownerName,
}: {
  state: AttendanceState;
  ownerName: string;
}) {
  const t = useTranslations();
  if (state === 'AVAILABLE') {
    return (
      <Badge variant="success" className="gap-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t('alerts.attendance.statusAvailable')}
      </Badge>
    );
  }
  if (state === 'CLOSED') {
    return <Badge variant="success">{t('alerts.attendance.statusClosedBadge')}</Badge>;
  }
  if (state === 'IN_PROGRESS_BY_ME') {
    return (
      <Badge variant="warning">
        {t('alerts.attendance.statusInProgressByYou')}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1">
      <Lock className="h-3 w-3" />
      {t('alerts.attendance.statusInProgressByOther', { name: ownerName })}
    </Badge>
  );
}

function AttendanceActionButton({
  state,
  ownerName,
  isOperator,
  onClick,
}: {
  state: AttendanceState;
  ownerName: string;
  isOperator: boolean;
  onClick: () => void;
}) {
  const t = useTranslations();

  if (state === 'CLOSED') {
    return (
      <Button size="sm" variant="ghost" onClick={onClick}>
        <ShieldCheck className="h-4 w-4" />
        {t('alerts.attendance.viewHistory')}
      </Button>
    );
  }

  if (state === 'IN_PROGRESS_BY_OTHER') {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled
        title={t('alerts.attendance.lockedBy', { name: ownerName })}
      >
        <Lock className="h-4 w-4" />
        {t('alerts.attendance.inProgressByOtherShort')}
      </Button>
    );
  }

  if (state === 'IN_PROGRESS_BY_ME') {
    return (
      <Button size="sm" onClick={onClick}>
        <ShieldCheck className="h-4 w-4" />
        {t('alerts.attendance.continueAttendance')}
      </Button>
    );
  }

  // AVAILABLE
  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={!isOperator}
      title={!isOperator ? t('alerts.attendance.operatorOnly') : undefined}
    >
      <Circle className="h-4 w-4" />
      {t('alerts.attendance.openAttendance')}
    </Button>
  );
}

export const MonitorEventCard = memo(MonitorEventCardImpl);
