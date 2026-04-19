'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Bell, Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { usePagination } from '@/hooks/use-pagination';
import { useUserScope, applyUserScope } from '@/hooks/use-user-scope';
import { useAuth } from '@/hooks/use-auth';
import type { PatrolAction, TimeEntry } from '@/types/api';
import { useCallContext } from '@/features/calls/call-context';
import { ChatConnectionBadge } from '@/features/calls/call-dialog';
import { formatDeviceLabel, resolveCallTargetId } from '@/features/alerts/device-label';
import { AttendanceDialog } from '@/features/alerts/attendance-dialog';
import { MonitorEventCard } from '@/features/alerts/monitor-event-card';
import { MonitorTimeEntryRow } from '@/features/alerts/monitor-time-entry-row';
import { classifyAttendance } from '@/features/alerts/attendance-state';

/**
 * Window the card-level highlight ("flash") stays on after a new event
 * arrives through a real-time push. Anything older than this gets
 * rendered calmly so the operator's attention is pulled to what's
 * actually new.
 */
const FLASH_WINDOW_MS = 15_000;

/**
 * Maximum IDs we remember as "seen" between realtime pushes. Bounded to
 * avoid unbounded memory growth on long operator shifts.
 */
const SEEN_IDS_CAP = 500;

export default function AlertMonitorPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <AlertMonitor />
    </RoleGuard>
  );
}

function AlertMonitor() {
  const t = useTranslations();
  const scope = useUserScope();
  const call = useCallContext();
  const { user } = useAuth();
  const currentUserId = user?._id;
  const isOperator = user?.companyUser?.subtype === 'OPERATOR';

  const patrolPagination = usePagination({ initialPageSize: 50 });
  const timePagination = usePagination({ initialPageSize: 50 });
  const timeWindow = useMemo(
    () => ({
      startDate: last7DaysISO(),
      endDate: nowISO(),
    }),
    [],
  );

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

  const events = useMemo<PatrolAction[]>(() => patrolQuery.data?.results || [], [patrolQuery.data]);
  const timeEntries = useMemo<TimeEntry[]>(() => timeQuery.data?.results || [], [timeQuery.data]);

  // When another operator claims/closes the event this dialog is showing,
  // the `events` list refreshes but the `attendanceEvent` state still holds
  // the old snapshot — the dialog would keep its old "available" button
  // and the lock-out would not kick in. Rebind to the live row so the
  // dialog's state-derived UI stays in sync with the realtime feed.
  const liveAttendanceEvent = useMemo(() => {
    if (!attendanceEvent) return null;
    return events.find((e) => e._id === attendanceEvent._id) || attendanceEvent;
  }, [attendanceEvent, events]);

  // ── Flash-new-event tracking ─────────────────────────────────────
  // Pattern: a first-seen timestamp per _id lives in a ref (so it survives
  // re-renders without re-triggering them). Stamping happens in an effect
  // after each query refetch, and a one-second `tick` state drives calm
  // re-renders while the flash window is active. Keeps the work out of
  // render to satisfy the pure-render rule.
  const flashState = useFreshlyArrivedFlash(events, FLASH_WINDOW_MS);
  const timeFlashState = useFreshlyArrivedFlash(timeEntries, FLASH_WINDOW_MS);
  const flashEventCount = flashState.count;
  const flashTimeEntryCount = timeFlashState.count;
  const isFlashingEvent = flashState.isFlashing;
  const isFlashingTimeEntry = timeFlashState.isFlashing;

  // Realtime: handled globally by SosNotificationProvider. Having a
  // second listener here would race on the Firestore doc-deletion
  // pattern and produce duplicate toasts — we deliberately don't
  // call useAlertportRealtime inside the page anymore.

  // ── Stable handlers — keep the EventCard memos effective ─────────
  const handleAttend = useCallback((event: PatrolAction) => {
    setAttendanceEvent(event);
  }, []);

  const handleCall = useCallback(
    (event: PatrolAction, mode: 'NORMAL' | 'SILENT_LISTEN') => {
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
    },
    [call, t],
  );

  const handleClearFilters = useCallback(() => {
    setHierarchy({});
    setActiveHierarchy({});
  }, []);

  const handleSearch = useCallback(() => {
    setActiveHierarchy(hierarchy);
  }, [hierarchy]);

  const handleAttendanceChanged = useCallback(() => {
    patrolQuery.refetch();
  }, [patrolQuery]);

  const closeAttendance = useCallback((open: boolean) => {
    if (!open) setAttendanceEvent(null);
  }, []);

  // ── Deep link handling: /alerts/monitor?patrolAction=<id>&autoClaim=1 ──
  // When the SosNotificationProvider's global banner fires a claim(),
  // the operator lands here with query params that identify the target
  // event. We resolve it against the freshly-fetched patrol-actions
  // list, then let the AttendanceDialog's existing auto-open effect
  // claim the attendance. The params are stripped immediately after
  // consumption so a refresh doesn't re-trigger the flow.
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkPatrolActionId = searchParams?.get('patrolAction') ?? null;
  const deepLinkAutoClaim = searchParams?.get('autoClaim') === '1';
  const consumedDeepLinkRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deepLinkPatrolActionId && !deepLinkAutoClaim) return;
    if (patrolQuery.isLoading) return;
    if (consumedDeepLinkRef.current === deepLinkPatrolActionId) return;

    let target: PatrolAction | null = null;
    if (deepLinkPatrolActionId) {
      target = events.find((e) => e._id === deepLinkPatrolActionId) ?? null;
    }
    // Fallback: no hint or hint missed — grab the newest SOS that's
    // still available for attendance. Better than dead-ending the
    // operator on an empty monitor.
    if (!target && deepLinkAutoClaim) {
      target =
        events.find(
          (e) =>
            e.type === 'SOS_ALERT' &&
            classifyAttendance(e, currentUserId) === 'AVAILABLE',
        ) ?? null;
    }

    if (target) {
      consumedDeepLinkRef.current = deepLinkPatrolActionId ?? target._id;
      const claimedTarget = target;
      // Defer state updates to a microtask so we're updating "from
      // outside" the effect body (callback-style), matching what
      // react-hooks/set-state-in-effect allows.
      queueMicrotask(() => {
        setAttendanceEvent(claimedTarget);
        router.replace('/alerts/monitor');
      });
    }
  }, [
    deepLinkPatrolActionId,
    deepLinkAutoClaim,
    events,
    patrolQuery.isLoading,
    currentUserId,
    router,
  ]);

  const callInProgress = !!call && call.status !== 'idle' && call.status !== 'ended';
  const socketConnected = call?.socketConnected ?? false;

  const sosCount = useMemo(
    () => events.filter((e) => e.type === 'SOS_ALERT').length,
    [events],
  );
  // Counts keyed to the classifier so the KPIs tell the same story the
  // cards tell. "Disponíveis" (AVAILABLE) is the operator's actionable
  // queue — worth pulsing in the UI when > 0.
  const availableCount = useMemo(
    () => events.filter((e) => classifyAttendance(e, currentUserId) === 'AVAILABLE').length,
    [events, currentUserId],
  );
  const attendingCount = useMemo(
    () => {
      let n = 0;
      for (const e of events) {
        const s = classifyAttendance(e, currentUserId);
        if (s === 'IN_PROGRESS_BY_ME' || s === 'IN_PROGRESS_BY_OTHER') n += 1;
      }
      return n;
    },
    [events, currentUserId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('alerts.monitor')}
        description={t('sidebar.monitoring')}
        action={<ChatConnectionBadge connected={socketConnected} />}
      />

      <FilterPanel
        extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
        fields={[]}
        values={{}}
        onChange={() => {}}
        onSearch={handleSearch}
        onClear={handleClearFilters}
      />

      <MonitorKpiGrid
        eventsCount={events.length}
        sosCount={sosCount}
        availableCount={availableCount}
        attendingCount={attendingCount}
        timeEntriesCount={timeEntries.length}
        isLoadingEvents={patrolQuery.isLoading}
        isLoadingTime={timeQuery.isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-500" />
              {t('alerts.timeline')}
              {flashEventCount > 0 && (
                <Badge variant="brand" className="animate-pulse">
                  {t('alerts.realtime.newEvents', { count: flashEventCount })}
                </Badge>
              )}
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
                  <MonitorEventCard
                    key={event._id}
                    event={event}
                    currentUserId={currentUserId}
                    isOperator={isOperator}
                    onAttend={handleAttend}
                    onCall={handleCall}
                    callInProgress={callInProgress}
                    socketConnected={socketConnected}
                    flash={isFlashingEvent(event._id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              {t('attendance.timeEntries')}
              {flashTimeEntryCount > 0 && (
                <Badge variant="brand" className="animate-pulse">
                  {t('alerts.realtime.newEntries', { count: flashTimeEntryCount })}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeQuery.isLoading ? (
              <div className="py-12 flex justify-center">
                <Spinner />
              </div>
            ) : timeEntries.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={t('attendance.noTimeEntries')}
                description={t('common.noData')}
              />
            ) : (
              <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
                {timeEntries.map((entry) => (
                  <MonitorTimeEntryRow
                    key={entry._id}
                    entry={entry}
                    flash={isFlashingTimeEntry(entry._id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AttendanceDialog
        open={!!attendanceEvent}
        onOpenChange={closeAttendance}
        event={liveAttendanceEvent}
        onChanged={handleAttendanceChanged}
      />
    </div>
  );
}

interface KpiGridProps {
  eventsCount: number;
  sosCount: number;
  availableCount: number;
  attendingCount: number;
  timeEntriesCount: number;
  isLoadingEvents: boolean;
  isLoadingTime: boolean;
}

/**
 * Memoized KPI grid. The monitor re-renders often (realtime toasts,
 * scroll, dialog open/close) and the KPI cards carry their own subtree
 * with spinners and icons — keeping them out of the parent's render
 * loop materially reduces work per frame.
 *
 * KPI order reflects the operator's priority:
 *   1. Total today — context.
 *   2. SOS — lethal priority.
 *   3. Disponíveis — the actionable queue (pulses when > 0).
 *   4. Em atendimento — what someone (including this user) is handling.
 *   5. Registros de ponto — workforce signal.
 */
const MonitorKpiGrid = memo(function MonitorKpiGridImpl({
  eventsCount,
  sosCount,
  availableCount,
  attendingCount,
  timeEntriesCount,
  isLoadingEvents,
  isLoadingTime,
}: KpiGridProps) {
  const t = useTranslations();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard
        title={t('dashboard.todayOccurrences')}
        value={eventsCount}
        icon={Bell}
        accent="brand"
        isLoading={isLoadingEvents}
      />
      <KpiCard
        title={t('alerts.sosAlert')}
        value={sosCount}
        icon={AlertTriangle}
        accent="danger"
        isLoading={isLoadingEvents}
      />
      <KpiCard
        title={t('alerts.attendance.statusAvailable')}
        value={availableCount}
        icon={Bell}
        accent="success"
        isLoading={isLoadingEvents}
      />
      <KpiCard
        title={t('alerts.attendance.statusInProgress')}
        value={attendingCount}
        icon={ShieldCheck}
        accent="warning"
        isLoading={isLoadingEvents}
      />
      <KpiCard
        title={t('attendance.timeEntries')}
        value={timeEntriesCount}
        icon={Clock}
        accent="info"
        isLoading={isLoadingTime}
      />
    </div>
  );
});

interface FlashState {
  count: number;
  isFlashing: (id: string) => boolean;
}

/**
 * Track which items in `list` arrived after the first fetch and expose a
 * short-lived "is flashing" signal per _id. The first load is considered
 * baseline (stamp = 0, never flashes). Anything added afterwards starts
 * the clock.
 *
 * Flash expiry is driven by a one-second tick state only while there's
 * at least one live flash — no wasted renders while idle.
 */
function useFreshlyArrivedFlash<T extends { _id: string }>(
  list: T[],
  windowMs: number,
): FlashState {
  // Refs are ONLY used to decide what's fresh after the first load — never
  // read during render (ESLint refs rule). `flashing` is the state surfaced
  // to the renderer; a per-id timer removes each entry after windowMs.
  const seenIds = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [flashing, setFlashing] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const seen = seenIds.current;
    if (!seeded.current) {
      for (const item of list) seen.add(item._id);
      if (list.length > 0) seeded.current = true;
      return;
    }
    const freshly: string[] = [];
    for (const item of list) {
      if (!seen.has(item._id)) {
        seen.add(item._id);
        freshly.push(item._id);
      }
    }
    if (seen.size > SEEN_IDS_CAP) {
      const toDrop = seen.size - SEEN_IDS_CAP;
      const it = seen.values();
      for (let i = 0; i < toDrop; i += 1) {
        const v = it.next().value;
        if (v) seen.delete(v);
      }
    }
    if (freshly.length === 0) return;
    const timersMap = timers.current;
    // Defer the flashing-set update to a microtask so we're updating state
    // from "outside" the effect body (callback-style), matching what
    // react-hooks/set-state-in-effect actually allows. Same reason the
    // expiry updates use setTimeout callbacks rather than inline setState.
    const raf =
      typeof queueMicrotask === 'function'
        ? (cb: () => void) => queueMicrotask(cb)
        : (cb: () => void) => setTimeout(cb, 0);
    raf(() => {
      setFlashing((prev) => {
        const next = new Set(prev);
        freshly.forEach((id) => next.add(id));
        return next;
      });
    });
    for (const id of freshly) {
      const existing = timersMap.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setFlashing((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        timersMap.delete(id);
      }, windowMs);
      timersMap.set(id, timer);
    }
  }, [list, windowMs]);

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach((t) => clearTimeout(t));
      timersMap.clear();
    };
  }, []);

  return useMemo<FlashState>(
    () => ({
      count: flashing.size,
      isFlashing: (id: string) => flashing.has(id),
    }),
    [flashing],
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

