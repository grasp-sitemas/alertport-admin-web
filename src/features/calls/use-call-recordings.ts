'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useCallContext } from './call-context';

export interface CallRecordingRow {
  _id: string;
  roomId: string;
  callMode: 'NORMAL' | 'SILENT_LISTEN';
  peerUserId: string;
  operatorUserId: string;
  peerLabel?: string;
  operatorLabel?: string;
  accountId?: string | null;
  clientId?: string | null;
  clientName?: string;
  siteId?: string | null;
  siteName?: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number;
  mimeType: string;
  bytes: number;
  createdAt: string;
  /**
   * Optional product discriminator. AlertPort and ShieldGo share the same
   * legacy recordings storage, but each product has its own admin web. When
   * the backend attaches one of these fields we use it to filter so this
   * admin only shows AlertPort recordings.
   *
   * The backend may surface the discriminator as `source`/`product` directly
   * on the recording, or via the peer's `clientType` (e.g. `ALERTPORT_DEVICE`
   * vs `SHIELDGO_DEVICE`). All shapes are accepted - see
   * `isAlertportRecording`.
   */
  source?: string | null;
  product?: string | null;
  peerClientType?: string | null;
}

/**
 * Source/product tokens that identify a recording as belonging to AlertPort.
 * Matched case-insensitively so backend variants (`alertport`, `ALERTPORT`,
 * `ALERTPORT_DEVICE`, ...) all resolve correctly.
 */
const ALERTPORT_SOURCE_TOKENS = ['ALERTPORT', 'ALERTPORT_DEVICE'];

/**
 * Predicate used to filter ShieldGo recordings out of the AlertPort admin.
 *
 * Strategy (per Flavio's feedback "Não trazer gravações do ShieldGo"):
 *  - We send `source: 'ALERTPORT'` in the socket filter payload as a hint
 *    for the backend (option A in the design doc).
 *  - Independently, we filter client-side here using whatever discriminator
 *    the row carries (option B): `source`, `product`, or `peerClientType`.
 *  - When no discriminator exists at all (option C), we keep the row to
 *    stay graceful and avoid hiding legitimate AlertPort traffic on a
 *    backend that hasn't been updated yet. The hint above is harmless in
 *    that case.
 */
export function isAlertportRecording(row: CallRecordingRow): boolean {
  const candidates = [row.source, row.product, row.peerClientType];
  const present = candidates.filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  if (present.length === 0) {
    return true;
  }
  return present.some((value) =>
    ALERTPORT_SOURCE_TOKENS.includes(value.toUpperCase()),
  );
}

interface ListAck {
  ok: boolean;
  recordings?: CallRecordingRow[];
  nextCursor?: string | null;
  error?: string;
}

interface UrlAck {
  ok: boolean;
  url?: string;
  mimeType?: string;
  error?: string;
}

export interface RecordingsFilter {
  accountId?: string;
  clientId?: string;
  siteId?: string;
  roomId?: string;
  callMode?: 'NORMAL' | 'SILENT_LISTEN' | '';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Server error codes we treat as transient on the client side. These never
 * surface to the user as text - we just keep showing the loading state and
 * retry once the socket is ready. Anything else is a real error and gets
 * mapped to a localized message in the panel.
 */
const TRANSIENT_ERRORS = new Set(['NOT_REGISTERED', 'SERVER_ERROR']);
const RETRY_DELAY_MS = 400;
const MAX_TRANSIENT_RETRIES = 10;

/**
 * Paginated recordings list. The backend returns an opaque `nextCursor` based
 * on createdAt+_id; we feed it back to fetch the next page. Server scopes the
 * query by the caller's accountId by default; SUPER_ADMIN_MASTER can override
 * via the `accountId` filter to audit other tenants.
 *
 * `refresh()` resets the list and pulls the first page again - used for the
 * refresh button and whenever the filter changes.
 * `loadMore()` appends the next page; no-ops when there is nothing more.
 */
export function useCallRecordings(filter: RecordingsFilter = {}) {
  const [recordings, setRecordings] = useState<CallRecordingRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the global socket session state so we only fire requests after
  // user:register has been ack'd. Prevents the NOT_REGISTERED flash on
  // first paint. `useCallContext()` returns null when the user isn't
  // authenticated yet - in that case we just wait.
  const call = useCallContext();
  const socketReady = call?.socketReady ?? false;

  const { accountId, clientId, siteId, roomId, callMode, startDate, endDate, limit = 50 } = filter;
  // Snapshot of the latest filter values so callbacks aren't stale when the
  // consumer mutates them mid-flight. Strings-only so equality is trivial.
  const filterRef = useRef<RecordingsFilter>({
    accountId,
    clientId,
    siteId,
    roomId,
    callMode,
    startDate,
    endDate,
    limit,
  });
  useEffect(() => {
    filterRef.current = {
      accountId,
      clientId,
      siteId,
      roomId,
      callMode,
      startDate,
      endDate,
      limit,
    };
  }, [accountId, clientId, siteId, roomId, callMode, startDate, endDate, limit]);

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Self-reference for the retry loop: the useCallback closure technically
  // sees `fetchPage` from the outer scope, but react-hooks/immutability
  // rightly flags the forward-reference. Storing the current implementation
  // on a ref makes the retry path explicit and resilient to future edits
  // that might change fetchPage's deps.
  const fetchPageRef = useRef<
    ((cursor: string | null, mode: 'replace' | 'append') => void) | null
  >(null);

  const fetchPage = useCallback(
    (cursor: string | null, mode: 'replace' | 'append') => {
      const socket = getSocket();
      if (mode === 'replace') setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const current = filterRef.current;
      const payload: Record<string, unknown> = {
        limit: current.limit,
        cursor,
        // Hint to the backend that this admin only wants AlertPort
        // recordings. Backends that honor the field do the filtering
        // server-side; older builds ignore the extra key as a no-op. We
        // also filter defensively on the client (see `isAlertportRecording`)
        // so ShieldGo recordings never leak into the AlertPort UI.
        source: 'ALERTPORT',
      };
      // Only send filter keys the user actually set - the backend treats
      // missing keys as "no filter", so this keeps the payload small and
      // the Heroku logs readable.
      if (current.accountId) payload.accountId = current.accountId;
      if (current.clientId) payload.clientId = current.clientId;
      if (current.siteId) payload.siteId = current.siteId;
      if (current.roomId) payload.roomId = current.roomId;
      if (current.callMode) payload.callMode = current.callMode;
      if (current.startDate) payload.startDate = current.startDate;
      if (current.endDate) payload.endDate = current.endDate;

      socket.emit('call:recordings:list', payload, (ack: ListAck) => {
        // Transient errors (socket not yet registered, generic server hiccup)
        // keep the UI in loading state and retry automatically. The user
        // never sees a raw error code.
        if (!ack?.ok && ack?.error && TRANSIENT_ERRORS.has(ack.error)) {
          if (retryCountRef.current < MAX_TRANSIENT_RETRIES) {
            retryCountRef.current += 1;
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(
              () => fetchPageRef.current?.(cursor, mode),
              RETRY_DELAY_MS,
            );
            return;
          }
          // Exhausted retries - fall through to the real-error branch below.
        }

        retryCountRef.current = 0;
        if (mode === 'replace') setLoading(false);
        else setLoadingMore(false);

        if (!ack?.ok) {
          setError(ack?.error ?? 'UNKNOWN');
          if (mode === 'replace') setRecordings([]);
          return;
        }

        // Defensive client-side filter: drop ShieldGo rows in case the
        // backend ignored the `source: 'ALERTPORT'` hint above. Keeps the
        // AlertPort admin focused on its own product.
        const incoming = (ack.recordings ?? []).filter(isAlertportRecording);
        setRecordings((prev) => (mode === 'replace' ? incoming : [...prev, ...incoming]));
        setNextCursor(ack.nextCursor ?? null);
      });
    },
    [],
  );
  // Keep the ref pointing at the current implementation so the retry
  // timer always calls the latest version of fetchPage. With `[]` deps
  // this is a no-op refresh, but future edits that add deps get safe
  // retry behavior for free.
  useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  const refresh = useCallback(() => {
    if (!socketReady) {
      // Park the UI in loading state until the socket finishes registering;
      // the effect below will trigger a real fetch once socketReady flips.
      setLoading(true);
      return;
    }
    fetchPage(null, 'replace');
  }, [fetchPage, socketReady]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loading || loadingMore || !socketReady) return;
    fetchPage(nextCursor, 'append');
  }, [fetchPage, nextCursor, loading, loadingMore, socketReady]);

  useEffect(() => {
    // Initial fetch on mount + re-fetch when filter changes OR socketReady
    // flips true. `refresh()` either fires the socket RPC (setState happens
    // in the ack callback - not synchronous) or, when socketReady is false,
    // flips loading=true so the UI parks until registration lands. The
    // second branch IS a synchronous setState, so defer it to a microtask
    // to satisfy react-hooks/set-state-in-effect without a disable comment.
    queueMicrotask(() => {
      refresh();
    });
  }, [accountId, clientId, siteId, roomId, callMode, startDate, endDate, limit, socketReady, refresh]);

  // Cleanup any pending retry when the hook unmounts or filter changes.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const getSignedUrl = useCallback((recordingId: string): Promise<string | null> => {
    const socket = getSocket();
    return new Promise((resolve) => {
      socket.emit('call:recording:url', { recordingId }, (ack: UrlAck) => {
        resolve(ack?.ok && ack.url ? ack.url : null);
      });
    });
  }, []);

  return {
    recordings,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(nextCursor),
    refresh,
    loadMore,
    getSignedUrl,
  };
}
