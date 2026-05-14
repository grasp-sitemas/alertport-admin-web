'use client';
export const dynamic = 'force-dynamic';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Bell, Clock, Search, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { RoleGuard } from '@/components/shared/role-guard';
import { ModuleGuard } from '@/components/shared/module-guard';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { FilterPanel } from '@/components/shared/filter-panel';
import {
  HierarchyFilters,
  type HierarchyFiltersValue,
} from '@/components/shared/hierarchy-filters';
import { KpiCard } from '@/features/dashboard/kpi-card';
import {
  usePatrolActionsForMonitor,
  useTimeEntries,
  useAttendanceTypes,
} from '@/features/alerts/use-occurrences';
import { usePagination } from '@/hooks/use-pagination';
import { useUserScope, applyUserScope } from '@/hooks/use-user-scope';
import { useAuth } from '@/hooks/use-auth';
import { useSessionAccountModules } from '@/features/modules/use-session-account-modules';
import type { EventType, PatrolAction, TimeEntry } from '@/types/api';
import { useCallContext } from '@/features/calls/call-context';
import { ChatConnectionBadge } from '@/features/calls/call-dialog';
import { formatDeviceLabel, resolveCallTargetId } from '@/features/alerts/device-label';
import { AttendanceDialog } from '@/features/alerts/attendance-dialog';
import { MonitorTimeEntryRow } from '@/features/alerts/monitor-time-entry-row';
import { VirtualizedEventList } from '@/features/alerts/virtualized-event-list';
import { classifyAttendance, type AttendanceState } from '@/features/alerts/attendance-state';
import {
  MONITOR_CATEGORIES,
  MONITOR_EVENT_TYPES,
  MONITOR_STATUS_VALUES,
  filterMonitorEvents,
  type MonitorCategory,
  type MonitorClientFilters,
} from '@/features/alerts/monitor-filter';

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

interface DraftFilters {
  startDate: string;
  endDate: string;
  type: EventType | '';
  status: AttendanceState | '';
  category: MonitorCategory | '';
}

const EMPTY_DRAFT_FILTERS: DraftFilters = {
  startDate: '',
  endDate: '',
  type: '',
  status: '',
  category: '',
};

const CATEGORY_LABEL_KEYS: Record<MonitorCategory, string> = {
  SOS: 'alerts.categories.sos',
  OCCURRENCE_MISSED: 'alerts.categories.occurrenceMissed',
  TIME_TRACKING: 'alerts.categories.timeTracking',
};

/**
 * i18n keys mirrored from {@link MonitorEventCard}'s EVENT_META so the
 * filter Select options and the card labels stay in sync without
 * exporting internal state between the two modules.
 */
const EVENT_TYPE_LABEL_KEYS: Record<EventType, string> = {
  SOS_ALERT: 'alerts.sosAlert',
  INCIDENT: 'alerts.incident',
  CRASH: 'alerts.crash',
  LOWVOLTAGE: 'alerts.lowVoltage',
  CANCEL_PATROL: 'alerts.cancelPatrol',
  FAILURE_PATROL: 'alerts.failurePatrol',
  OCCURRENCE_MISSED: 'alerts.occurrenceMissed',
};

const ATTENDANCE_STATUS_LABEL_KEYS: Record<AttendanceState, string> = {
  AVAILABLE: 'alerts.attendance.statusAvailable',
  IN_PROGRESS_BY_ME: 'alerts.attendance.statusInProgressByYou',
  IN_PROGRESS_BY_OTHER: 'alerts.attendance.statusInProgress',
  CLOSED: 'alerts.attendance.statusClosedBadge',
};

export default function AlertMonitorPage() {
  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN', 'MANAGER', 'OPERATOR']}>
      <ModuleGuard moduleKey="MONITOR">
        <ErrorBoundary tag="alert-monitor">
          <AlertMonitor />
        </ErrorBoundary>
      </ModuleGuard>
    </RoleGuard>
  );
}

function AlertMonitor() {
  const t = useTranslations();
  const scope = useUserScope();
  const { isEnabled: isModuleEnabled } = useSessionAccountModules();
  // Time-entries are gated by the per-account `TIME_ENTRIES` module. When
  // the SAM disables the module for a tenant, we hide the right-hand card
  // AND the KPI tile — and skip the network call entirely so an operator
  // of the disabled tenant never spends a request fetching data they
  // can't see. SAM bypasses the gate (sees everything to administer it).
  const timeEntriesModuleEnabled = isModuleEnabled('TIME_ENTRIES');
  // Call modules. When both off (AP 2G replacement tier), socket
  // never connects (gated in CallProvider) and call buttons / online
  // badge are hidden from the operator UI.
  const callNormalEnabled = isModuleEnabled('CALL_NORMAL');
  const callSilentEnabled = isModuleEnabled('CALL_SILENT');
  const callsAnyEnabled = callNormalEnabled || callSilentEnabled;
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

  // Draft vs active split:
  //   `draftFilters` follows the FilterPanel's current input state and only
  //   becomes `activeFilters` when the operator clicks "Buscar". This keeps
  //   the server query stable while the operator is typing, matching the
  //   UX on the other list pages (occurrences, attendance, reports).
  //
  //   startDate/endDate go to the server; type/status are applied
  //   client-side via `filterMonitorEvents` so toggling them does not
  //   trigger a refetch.
  const [draftFilters, setDraftFilters] = useState<DraftFilters>(EMPTY_DRAFT_FILTERS);
  const [activeFilters, setActiveFilters] = useState<DraftFilters>(EMPTY_DRAFT_FILTERS);

  // Real-time search box above the events list. Not tied to the "Buscar"
  // button - it live-filters what's already loaded, so operators can
  // scan a large queue without triggering round-trips.
  const [searchText, setSearchText] = useState('');

  const patrolQuery = usePatrolActionsForMonitor({
    ...applyUserScope(
      {
        skip: patrolPagination.paginationParams.skip,
        limit: patrolPagination.paginationParams.limit,
        ...(activeFilters.startDate ? { startDate: activeFilters.startDate } : {}),
        ...(activeFilters.endDate ? { endDate: activeFilters.endDate } : {}),
      },
      scope,
    ),
    ...(activeHierarchy.account ? { account: activeHierarchy.account } : {}),
    ...(activeHierarchy.client ? { client: activeHierarchy.client } : {}),
    ...(activeHierarchy.site ? { site: activeHierarchy.site } : {}),
  });

  const timeQuery = useTimeEntries(
    {
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
    },
    timeEntriesModuleEnabled,
  );

  // Prefetch attendance types catalog - speeds up the first AttendanceDialog open.
  useAttendanceTypes();

  const events = useMemo<PatrolAction[]>(() => patrolQuery.data?.results || [], [patrolQuery.data]);
  const timeEntries = useMemo<TimeEntry[]>(() => timeQuery.data?.results || [], [timeQuery.data]);

  // Client-side slice of `events`. The type/status filters and the search
  // box run here so toggling them is instant (no refetch). Hierarchy and
  // date range remain server-side because they shrink the dataset before
  // it crosses the wire.
  const typeLabelFor = useCallback(
    (type: EventType): string | undefined => {
      const key = EVENT_TYPE_LABEL_KEYS[type];
      return key ? t(key) : undefined;
    },
    [t],
  );

  const clientFilters = useMemo<MonitorClientFilters>(
    () => ({
      q: searchText,
      type: activeFilters.type,
      status: activeFilters.status,
      category: activeFilters.category,
    }),
    [searchText, activeFilters.type, activeFilters.status, activeFilters.category],
  );

  const filteredEvents = useMemo(
    () => filterMonitorEvents(events, clientFilters, currentUserId, typeLabelFor),
    [events, clientFilters, currentUserId, typeLabelFor],
  );

  const totalLoaded = events.length;
  const totalShown = filteredEvents.length;
  const hasClientFilter =
    !!clientFilters.q.trim() ||
    !!clientFilters.type ||
    !!clientFilters.status ||
    !!clientFilters.category;

  // Categorias disponíveis no filtro respeitam módulos da empresa.
  // - TIME_TRACKING só aparece se TIME_ENTRIES habilitado.
  // - OCCURRENCE_MISSED depende do módulo MONITOR (já gateado pelo
  //   ModuleGuard da página, mas mantemos coerência).
  // SAM (super admin) vê tudo via isModuleEnabled().
  const availableCategories = useMemo<MonitorCategory[]>(() => {
    return MONITOR_CATEGORIES.filter((cat) => {
      if (cat === 'TIME_TRACKING') return timeEntriesModuleEnabled;
      return true;
    });
  }, [timeEntriesModuleEnabled]);

  // When another operator claims/closes the event this dialog is showing,
  // the `events` list refreshes but the `attendanceEvent` state still holds
  // the old snapshot - the dialog would keep its old "available" button
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
  // pattern and produce duplicate toasts - we deliberately don't
  // call useAlertportRealtime inside the page anymore.

  // ── Stable handlers - keep the EventCard memos effective ─────────
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
    setDraftFilters(EMPTY_DRAFT_FILTERS);
    setActiveFilters(EMPTY_DRAFT_FILTERS);
    setSearchText('');
  }, []);

  const handleSearch = useCallback(() => {
    setActiveHierarchy(hierarchy);
    setActiveFilters(draftFilters);
  }, [hierarchy, draftFilters]);

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setDraftFilters((prev) => ({ ...prev, [key]: (value as string) ?? '' }));
  }, []);

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
    // Fallback: no hint or hint missed - grab the newest SOS that's
    // still available for attendance. Better than dead-ending the
    // operator on an empty monitor.
    if (!target && deepLinkAutoClaim) {
      target =
        events.find(
          (e) => e.type === 'SOS_ALERT' && classifyAttendance(e, currentUserId) === 'AVAILABLE',
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

  const sosCount = useMemo(() => events.filter((e) => e.type === 'SOS_ALERT').length, [events]);
  // Counts keyed to the classifier so the KPIs tell the same story the
  // cards tell. "Disponíveis" (AVAILABLE) is the operator's actionable
  // queue - worth pulsing in the UI when > 0.
  const availableCount = useMemo(
    () => events.filter((e) => classifyAttendance(e, currentUserId) === 'AVAILABLE').length,
    [events, currentUserId],
  );
  const attendingCount = useMemo(() => {
    let n = 0;
    for (const e of events) {
      const s = classifyAttendance(e, currentUserId);
      if (s === 'IN_PROGRESS_BY_ME' || s === 'IN_PROGRESS_BY_OTHER') n += 1;
    }
    return n;
  }, [events, currentUserId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('alerts.monitor')}
        description={t('sidebar.monitoring')}
        action={callsAnyEnabled ? <ChatConnectionBadge connected={socketConnected} /> : null}
      />

      <FilterPanel
        extras={<HierarchyFilters value={hierarchy} onChange={setHierarchy} />}
        fields={[
          { key: 'startDate', labelKey: 'common.startDate', type: 'date' },
          { key: 'endDate', labelKey: 'common.endDate', type: 'date' },
          {
            key: 'category',
            labelKey: 'alerts.category',
            type: 'select',
            options: availableCategories.map((value) => ({
              value,
              label: t(CATEGORY_LABEL_KEYS[value]),
            })),
          },
          {
            key: 'type',
            labelKey: 'alerts.type',
            type: 'select',
            options: MONITOR_EVENT_TYPES.map((value) => ({
              value,
              label: t(EVENT_TYPE_LABEL_KEYS[value]),
            })),
          },
          {
            key: 'status',
            labelKey: 'alerts.status',
            type: 'select',
            options: MONITOR_STATUS_VALUES.map((value) => ({
              value,
              label: t(ATTENDANCE_STATUS_LABEL_KEYS[value]),
            })),
          },
        ]}
        values={draftFilters as unknown as Record<string, unknown>}
        onChange={handleFilterChange}
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
        showTimeEntries={timeEntriesModuleEnabled}
      />

      <div
        className={
          timeEntriesModuleEnabled
            ? 'grid grid-cols-1 gap-6 lg:grid-cols-3'
            : 'grid grid-cols-1 gap-6'
        }
      >
        <Card
          className={timeEntriesModuleEnabled ? 'lg:col-span-2' : ''}
          data-tour="monitor-events"
        >
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Bell className="text-brand-500 h-4 w-4" />
                {t('alerts.timeline')}
                {flashEventCount > 0 && (
                  <Badge variant="brand" className="animate-pulse">
                    {t('alerts.realtime.newEvents', { count: flashEventCount })}
                  </Badge>
                )}
              </CardTitle>
              {totalLoaded > 0 && (
                <span className="text-text-muted text-xs">
                  {hasClientFilter
                    ? `${t('common.showing')} ${totalShown} ${t('common.of')} ${totalLoaded}`
                    : `${totalLoaded} ${t('alerts.occurrences').toLowerCase()}`}
                </span>
              )}
            </div>
            <div className="relative mt-3">
              <Search className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('alerts.searchPlaceholder')}
                className="pr-9 pl-9"
                aria-label={t('common.search')}
              />
              {searchText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchText('')}
                  className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                  aria-label={t('common.clearFilters')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {patrolQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : totalLoaded === 0 ? (
              <EmptyState
                icon={Bell}
                title={t('alerts.noActiveEvents')}
                description={t('common.noData')}
              />
            ) : filteredEvents.length === 0 ? (
              <EmptyState
                icon={Search}
                title={t('common.noResults')}
                description={t('alerts.noEventsMatchFilter')}
              />
            ) : (
              <VirtualizedEventList
                events={filteredEvents}
                currentUserId={currentUserId}
                isOperator={isOperator}
                onAttend={handleAttend}
                onCall={handleCall}
                callInProgress={callInProgress}
                socketConnected={socketConnected}
                isFlashingEvent={isFlashingEvent}
                callNormalEnabled={callNormalEnabled}
                callSilentEnabled={callSilentEnabled}
              />
            )}
          </CardContent>
        </Card>

        {timeEntriesModuleEnabled && (
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
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : timeEntries.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title={t('attendance.noTimeEntries')}
                  description={t('common.noData')}
                />
              ) : (
                <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
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
        )}
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
  showTimeEntries: boolean;
}

/**
 * Memoized KPI grid. The monitor re-renders often (realtime toasts,
 * scroll, dialog open/close) and the KPI cards carry their own subtree
 * with spinners and icons - keeping them out of the parent's render
 * loop materially reduces work per frame.
 *
 * KPI order reflects the operator's priority:
 *   1. Total today - context.
 *   2. SOS - lethal priority.
 *   3. Disponíveis - the actionable queue (pulses when > 0).
 *   4. Em atendimento - what someone (including this user) is handling.
 *   5. Registros de ponto - workforce signal.
 */
const MonitorKpiGrid = memo(function MonitorKpiGridImpl({
  eventsCount,
  sosCount,
  availableCount,
  attendingCount,
  timeEntriesCount,
  isLoadingEvents,
  isLoadingTime,
  showTimeEntries,
}: KpiGridProps) {
  const t = useTranslations();
  // Drop the column when the TIME_ENTRIES module is off so the remaining
  // four KPIs spread across the row instead of leaving a blank slot.
  const gridClass = showTimeEntries
    ? 'grid grid-cols-2 lg:grid-cols-5 gap-4'
    : 'grid grid-cols-2 lg:grid-cols-4 gap-4';
  return (
    <div data-tour="monitor-kpis" className={gridClass}>
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
      {showTimeEntries && (
        <KpiCard
          title={t('attendance.timeEntries')}
          value={timeEntriesCount}
          icon={Clock}
          accent="info"
          isLoading={isLoadingTime}
        />
      )}
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
 * at least one live flash - no wasted renders while idle.
 */
function useFreshlyArrivedFlash<T extends { _id: string }>(
  list: T[],
  windowMs: number,
): FlashState {
  // Refs are ONLY used to decide what's fresh after the first load - never
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
