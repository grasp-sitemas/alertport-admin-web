'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, MapPin, Phone, Radio, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EventType, PatrolAction } from '@/types/api';
import { formatDeviceLabel, resolveCallTargetId } from './device-label';

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
  onAttend: (event: PatrolAction) => void;
  onCall: (event: PatrolAction, mode: 'NORMAL' | 'SILENT_LISTEN') => void;
  callInProgress: boolean;
  socketConnected: boolean;
  /** Highlight the card briefly after it arrived/updated via real-time. */
  flash?: boolean;
}

/**
 * Memoized event card. Isolates its render cost to a single row so that
 * parent re-renders (KPI tick, filters) don't sweep the whole timeline.
 * The parent passes stable callbacks (useCallback) so shallow-equal
 * props keep the memo effective.
 */
function MonitorEventCardImpl({
  event,
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
  const attendanceStatus = event.attendance?.status;
  const attendanceClosed = attendanceStatus === 'CLOSED';
  const attendanceInProgress =
    attendanceStatus === 'IN_PROGRESS' || !!event.attendance?.isAttendance;
  const deviceLabel = formatDeviceLabel(event);

  return (
    <div
      className={cn(
        'rounded-xl border border-white/8 p-4 transition-all',
        meta.accent === 'danger' && 'bg-red-500/5 border-red-500/20',
        meta.accent === 'warning' && 'bg-amber-500/5 border-amber-500/20',
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
              {attendanceClosed && (
                <Badge variant="success">{t('alerts.attendance.statusClosedBadge')}</Badge>
              )}
              {!attendanceClosed && attendanceInProgress && (
                <Badge variant="warning">{t('alerts.attendance.statusInProgress')}</Badge>
              )}
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
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => onAttend(event)}
            disabled={attendanceClosed}
            title={attendanceClosed ? t('alerts.attendance.statusClosedBadge') : undefined}
          >
            <ShieldCheck className="h-4 w-4" />
            {attendanceInProgress
              ? t('alerts.attendance.continueAttendance')
              : t('alerts.attendance.openAttendance')}
          </Button>

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

export const MonitorEventCard = memo(MonitorEventCardImpl);
