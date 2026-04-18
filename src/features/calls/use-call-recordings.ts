'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

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
 * Paginated recordings list. The backend returns an opaque `nextCursor` based
 * on createdAt+_id; we feed it back to fetch the next page. Server scopes the
 * query by the caller's accountId by default; SUPER_ADMIN_MASTER can override
 * via the `accountId` filter to audit other tenants.
 *
 * `refresh()` resets the list and pulls the first page again — used for the
 * refresh button and whenever the filter changes.
 * `loadMore()` appends the next page; no-ops when there is nothing more.
 */
export function useCallRecordings(filter: RecordingsFilter = {}) {
  const [recordings, setRecordings] = useState<CallRecordingRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  filterRef.current = { accountId, clientId, siteId, roomId, callMode, startDate, endDate, limit };

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
      };
      // Only send filter keys the user actually set — the backend treats
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
        if (mode === 'replace') setLoading(false);
        else setLoadingMore(false);

        if (!ack?.ok) {
          setError(ack?.error ?? 'ERROR');
          if (mode === 'replace') setRecordings([]);
          return;
        }

        const incoming = ack.recordings ?? [];
        setRecordings((prev) => (mode === 'replace' ? incoming : [...prev, ...incoming]));
        setNextCursor(ack.nextCursor ?? null);
      });
    },
    [],
  );

  const refresh = useCallback(() => {
    fetchPage(null, 'replace');
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loading || loadingMore) return;
    fetchPage(nextCursor, 'append');
  }, [fetchPage, nextCursor, loading, loadingMore]);

  useEffect(() => {
    // Initial fetch on mount + re-fetch when filter changes. The setState
    // calls happen inside the socket ack callback, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [accountId, clientId, siteId, roomId, callMode, startDate, endDate, limit, refresh]);

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
