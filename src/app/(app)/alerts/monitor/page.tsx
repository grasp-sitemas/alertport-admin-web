'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Bell,
  Clock,
  MapPin,
  Phone,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { RoleGuard } from '@/components/shared/role-guard';
import { FilterPanel } from '@/components/shared/filter-panel';
import {
  HierarchyFilters,
  type HierarchyFiltersValue,
} from '@/components/shared/hierarchy-filters';
import { KpiCard } from '@/features/dashboard/kpi-card';
import {
  usePatrolActions,
  useTimeEntries,
  useAttendanceTypes,
} from '@/features/alerts/use-occurrences';
import { useAlertportRealtime } from '@/features/alerts/use-realtime';
import { usePagination } from '@/hooks/use-pagination';
import { useUserScope, applyUserScope } from '@/hooks/use-user-scope';
import type { EventType, PatrolAction } from '@/types/api';
import { cn } from '@/lib/utils';
import { useCallContext } from '@/features/calls/call-context';
import { ChatConnectionBadge } from '@/features/calls/call-dialog';
import { formatDeviceLabel, resolveCallTargetId } from '@/features/alerts/device-label';
import { AttendanceDialog } from '@/features/alerts/attendance-dialog';

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

export default function AlertMonitorPage() {
  const t = useTranslations();
  const patrolPagination = usePagination({ initialPageSize: 50 });
  const timePagination = usePagination({ initialPageSize: 50 });
  const timeWindow = useMemo(
    () => ({
      startDate: last7DaysISO(),
      endDate: nowISO(),
    }),
    [],
  );

  const scope = useUserScope();
  const [hierarchy, setHierarchy] = useState<HierarchyFiltersValue>({});
  const [activeHierarchy, setActiveHierarchy] = useState<HierarchyFiltersValue>({});
  const [attendanceEvent, setAttendanceEvent] = useState<PatrolAction | null>(null);

  const patrolQuery = usePatrolActions({
    ...applyUserScope(
      {
        skip: patrolPagination.paginationParams.skip,
        limit: patrolPagination.paginationParams.limit,
      },
      scope,
    ),
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { site: activeHierarchy.site } : {}),
  });

  const timeQuery = useTimeEntries({
    ...applyUserScope(
      {
        skip: timePagination.paginationParams.skip,
        limit: timePagination.paginationParams.limit,
        ...timeWindow,
      },
      scope,
    ),
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { site: activeHierarchy.site } : {}),
  });

  // Prefetch attendance types catalog — speeds up the first AttendanceDialog open.
  useAttendanceTypes();

  // Real-time Firestore subscriptions (SOS, media, attendance updates).
  useAlertportRealtime({
    onEvent: (evt) => {
      if (evt.kind === 'notification') {
        const data = evt.data;
        const label = data.type || 'ALERT';
        toast.info(`${label}`, { description: t('alerts.eventDetails') });
        if (data.type === 'SOS_ALERT') {
          playAlarmSound();
        }
      }
    },
  });

  // Global call state (socket, WebRTC, ringing, etc.) — from CallProvider in AppShell.
  const call = useCallContext();

  const events = patrolQuery.data?.results || [];
  const timeEntries = timeQuery.data?.results || [];
  const sosCount = events.filter((e) => e.type === 'SOS_ALERT').length;

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <div className="space-y-6">
        <PageHeader
          title={t('alerts.monitor')}
          description={t('sidebar.monitoring')}
          action={<ChatConnectionBadge connected={call?.socketConnected ?? false} />}
        />

        <FilterPanel
          extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
          fields={[]}
          values={{}}
          onChange={() => {}}
          onSearch={() => setActiveHierarchy(hierarchy)}
          onClear={() => {
            setHierarchy({});
            setActiveHierarchy({});
          }}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            title={t('dashboard.todayOccurrences')}
            value={events.length}
            icon={Bell}
            accent="brand"
            isLoading={patrolQuery.isLoading}
          />
          <KpiCard
            title={t('alerts.sosAlert')}
            value={sosCount}
            icon={AlertTriangle}
            accent="danger"
            isLoading={patrolQuery.isLoading}
          />
          <KpiCard
            title={t('attendance.timeEntries')}
            value={timeEntries.length}
            icon={Clock}
            accent="info"
            isLoading={timeQuery.isLoading}
          />
        </div>

        {/* Active Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-500" />
              {t('alerts.timeline')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patrolQuery.isLoading ? (
              <div className="py-12 flex justify-center">
                <Spinner />
              </div>
            ) : events.length === 0 ? (
              <EmptyState
                icon={Bell}
                title={t('alerts.noActiveEvents')}
                description={t('common.noData')}
              />
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    onAttend={() => setAttendanceEvent(event)}
                    onCall={(mode) => {
                      if (!call) {
                        toast.error(t('calls.chatDisconnected'));
                        return;
                      }
                      const targetId = resolveCallTargetId(event);
                      if (!targetId) {
                        toast.error(t('calls.noTarget'));
                        return;
                      }
                      call.startCall({
                        to: targetId,
                        toLabel: formatDeviceLabel(event),
                        callMode: mode,
                      });
                    }}
                    callInProgress={
                      !!call && call.status !== 'idle' && call.status !== 'ended'
                    }
                    socketConnected={call?.socketConnected ?? false}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AttendanceDialog
          open={!!attendanceEvent}
          onOpenChange={(v) => !v && setAttendanceEvent(null)}
          event={attendanceEvent}
          onChanged={() => patrolQuery.refetch()}
        />
      </div>
    </RoleGuard>
  );
}

interface EventCardProps {
  event: PatrolAction;
  onAttend: () => void;
  onCall: (mode: 'NORMAL' | 'SILENT_LISTEN') => void;
  callInProgress: boolean;
  socketConnected: boolean;
}

function EventCard({
  event,
  onAttend,
  onCall,
  callInProgress,
  socketConnected,
}: EventCardProps) {
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
            onClick={onAttend}
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
            onClick={() => onCall('NORMAL')}
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
              onClick={() => onCall('SILENT_LISTEN')}
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

function last7DaysISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function nowISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function playAlarmSound() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextCtor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.1;
    o.start();
    o.stop(ctx.currentTime + 0.5);
  } catch {
    /* ignore */
  }
}
