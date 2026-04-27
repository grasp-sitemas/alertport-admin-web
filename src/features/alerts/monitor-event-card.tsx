'use client';

import { memo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Circle,
  ExternalLink,
  FileText,
  Lock,
  MapPin,
  Phone,
  Radio,
  Router,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { EventType, PatrolAction } from '@/types/api';
import { formatDeviceLabel, resolveCallTargetId } from './device-label';
import {
  classifyAttendance,
  extractAttendanceOwner,
  type AttendanceState,
} from './attendance-state';
import {
  buildMapsEmbedUrl,
  buildMapsUrl,
  formatCoordinates,
  resolveEventGeolocation,
} from './event-geolocation';

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
  const coords = resolveEventGeolocation(event);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);

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
        flash && 'border-brand-500/50 animate-pulse',
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
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <p className="text-sm font-medium text-white truncate">{deviceLabel}</p>
              {coords && (
                <button
                  type="button"
                  onClick={() => setMapDialogOpen(true)}
                  className={cn(
                    'inline-flex h-6 shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs text-text-secondary',
                    'bg-white/5 transition-colors hover:bg-white/10 hover:text-white',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  )}
                  aria-label={t('alerts.geolocation.openMapModal')}
                  title={t('alerts.geolocation.openMapModal')}
                >
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t('alerts.geolocation.mapChip')}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {(event.date || event.createdDate) &&
                new Date(event.date || event.createdDate!).toLocaleString()}
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
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
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
              </div>
            )}
            {coords && (
              <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
                <DialogContent className="max-w-3xl overflow-hidden border border-white/10 bg-bg-secondary p-0">
                  <DialogHeader className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-bg-secondary px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <DialogTitle>{t('alerts.geolocation.modalTitle')}</DialogTitle>
                        <DialogDescription>
                          {t('alerts.geolocation.modalDescription')}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-4 px-6 pb-6 pt-4">
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <iframe
                        src={buildMapsEmbedUrl(coords)}
                        title={t('alerts.geolocation.mapFrameTitle', {
                          coords: formatCoordinates(coords),
                        })}
                        className="h-[340px] w-full sm:h-[420px]"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    <div className="flex justify-end">
                      <a
                        href={buildMapsUrl(coords)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-200 transition-colors hover:border-cyan-300/60 hover:bg-cyan-400/20 hover:text-cyan-100"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        {t('alerts.geolocation.openInMaps', {
                          coords: formatCoordinates(coords),
                        })}
                      </a>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
