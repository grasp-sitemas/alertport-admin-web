'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToAlertportRealtime, type AlertportRealtimeEvent } from './realtime';
import { useUserScope } from '@/hooks/use-user-scope';

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
  const { accountId, clientId, siteId } = useUserScope();
  const onEventRef = useRef(options?.onEvent);

  useEffect(() => {
    onEventRef.current = options?.onEvent;
  }, [options?.onEvent]);

  const hierarchyKey = useMemo(
    () => `${accountId ?? ''}|${clientId ?? ''}|${siteId ?? ''}`,
    [accountId, clientId, siteId],
  );

  useEffect(() => {
    if (!accountId && !clientId && !siteId) return;

    const siteIds = [accountId, clientId, siteId].filter((v): v is string => Boolean(v));
    const siteGroupIds: string[] = [];

    const unsubscribe = subscribeToAlertportRealtime({
      siteIds,
      siteGroupIds,
      onlyAlertport: true,
      onEvent: (evt) => {
        switch (evt.kind) {
          case 'notification':
            queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
            queryClient.invalidateQueries({ queryKey: ['occurrences'] });
            queryClient.invalidateQueries({ queryKey: ['time-entries'] });
            break;
          case 'attendance:update':
          case 'attendance:close':
          case 'attendance:report':
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
  }, [hierarchyKey, accountId, clientId, siteId, queryClient]);
}
