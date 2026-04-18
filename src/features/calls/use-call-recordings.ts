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

interface Filter {
  roomId?: string;
  siteId?: string;
  limit?: number;
}

/**
 * Paginated recordings list. The backend returns an opaque `nextCursor` based
 * on createdAt+_id; we feed it back to fetch the next page. Server scopes the
 * query by the caller's accountId automatically.
 *
 * `refresh()` resets the list and pulls the first page again — used for the
 * refresh button and whenever the filter changes.
 * `loadMore()` appends the next page; no-ops when there is nothing more.
 */
export function useCallRecordings(filter: Filter = {}) {
  const [recordings, setRecordings] = useState<CallRecordingRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { roomId, siteId, limit = 50 } = filter;
  // Snapshot of the latest filter values so callbacks aren't stale when the
  // consumer mutates them mid-flight. Strings-only so equality is trivial.
  const filterRef = useRef<Filter>({ roomId, siteId, limit });
  filterRef.current = { roomId, siteId, limit };

  const fetchPage = useCallback(
    (cursor: string | null, mode: 'replace' | 'append') => {
      const socket = getSocket();
      if (mode === 'replace') setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const current = filterRef.current;
      socket.emit(
        'call:recordings:list',
        {
          roomId: current.roomId,
          siteId: current.siteId,
          limit: current.limit,
          cursor,
        },
        (ack: ListAck) => {
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
        },
      );
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
  }, [roomId, siteId, limit, refresh]);

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
