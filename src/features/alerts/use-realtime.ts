'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToAlertportRealtime, type AlertportRealtimeEvent } from './realtime';
import { useAuth } from '@/hooks/use-auth';

/**
 * Hook that wires Firestore real-time subscriptions for the currently logged-in user.
 * Invalidates related TanStack Query caches so the UI stays fresh without polling.
 *
 * Idempotent: unsubscribes when deps change or component unmounts — no listener leaks.
 */
export function useAlertportRealtime(options?: {
  onEvent?: (evt: AlertportRealtimeEvent) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const onEventRef = useRef(options?.onEvent);

  // Keep the callback ref fresh without re-subscribing
  useEffect(() => {
    onEventRef.current = options?.onEvent;
  }, [options?.onEvent]);

  // Stabilize IDs as plain primitives so effect deps are simple.
  const accountId = extractOneId(user?.account);
  const clientId = extractOneId(user?.client);
  const siteId = extractOneId(user?.site);
  const userId = user?._id;

  const hierarchyKey = useMemo(
    () => `${userId ?? ''}|${accountId ?? ''}|${clientId ?? ''}|${siteId ?? ''}`,
    [userId, accountId, clientId, siteId],
  );

  useEffect(() => {
    if (!userId) return;

    const siteIds = [accountId, clientId, siteId].filter((v): v is string => Boolean(v));
    const siteGroupIds: string[] = []; // populated when a site group is selected in UI

    const unsubscribe = subscribeToAlertportRealtime({
      siteIds,
      siteGroupIds,
      onlyAlertport: true,
      onEvent: (evt) => {
        // Invalidate data-dependent caches
        switch (evt.kind) {
          case 'notification':
            queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
            queryClient.invalidateQueries({ queryKey: ['occurrences'] });
            queryClient.invalidateQueries({ queryKey: ['time-entries'] });
            break;
          case 'attendance:update':
          case 'attendance:close':
          case 'attendance:report':
            queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
            break;
          case 'media':
            queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
            break;
        }
        onEventRef.current?.(evt);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [hierarchyKey, userId, accountId, clientId, siteId, queryClient]);
}

function extractOneId(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && '_id' in val) {
    const id = (val as { _id?: unknown })._id;
    if (typeof id === 'string') return id;
  }
  return undefined;
}
