'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';

export interface CallRecordingRow {
  _id: string;
  roomId: string;
  callMode: 'NORMAL' | 'SILENT_LISTEN';
  peerUserId: string;
  operatorUserId: string;
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
  error?: string;
}

interface UrlAck {
  ok: boolean;
  url?: string;
  mimeType?: string;
  error?: string;
}

export function useCallRecordings(filter: { roomId?: string; limit?: number } = {}) {
  const [recordings, setRecordings] = useState<CallRecordingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { roomId, limit = 50 } = filter;

  const refresh = useCallback(() => {
    const socket = getSocket();
    setLoading(true);
    setError(null);
    socket.emit(
      'call:recordings:list',
      { roomId, limit },
      (ack: ListAck) => {
        setLoading(false);
        if (!ack?.ok) {
          setError(ack?.error ?? 'ERROR');
          setRecordings([]);
          return;
        }
        setRecordings(ack.recordings ?? []);
      },
    );
  }, [roomId, limit]);

  useEffect(() => {
    // Initial fetch on mount + re-fetch when filter changes. The setState
    // calls happen inside the socket ack callback, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const getSignedUrl = useCallback((recordingId: string): Promise<string | null> => {
    const socket = getSocket();
    return new Promise((resolve) => {
      socket.emit('call:recording:url', { recordingId }, (ack: UrlAck) => {
        resolve(ack?.ok && ack.url ? ack.url : null);
      });
    });
  }, []);

  return { recordings, loading, error, refresh, getSignedUrl };
}
