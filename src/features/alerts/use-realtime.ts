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
  const { accountId, clientId, siteId, siteGroupId } = useUserScope();
  const onEventRef = useRef(options?.onEvent);

  useEffect(() => {
    onEventRef.current = options?.onEvent;
  }, [options?.onEvent]);

  const hierarchyKey = useMemo(
    () => `${accountId ?? ''}|${clientId ?? ''}|${siteId ?? ''}|${siteGroupId ?? ''}`,
    [accountId, clientId, siteId, siteGroupId],
  );

  useEffect(() => {
    if (!accountId && !clientId && !siteId && !siteGroupId) return;

    const siteIds = [accountId, clientId, siteId].filter((v): v is string => Boolean(v));
    // `updateAttendanceEvent/{siteGroupId}` is written by ms-user when an
    // operator opens/closes an attendance. Subscribing here is what makes the
    // monitor reactive to live attendance changes without a refetch round-trip.
    const siteGroupIds = siteGroupId ? [siteGroupId] : [];

    const unsubscribe = subscribeToAlertportRealtime({
      siteIds,
      siteGroupIds,
      onlyAlertport: true,
      onEvent: (evt) => {
        switch (evt.kind) {
          case 'notification':
            // Route by type: TIME_ENTRY events don't touch patrol-actions, so
            // only invalidate the time-entries list to avoid waking the whole
            // timeline. SOS/INCIDENT/CRASH/... still refresh both lists.
            if (evt.data.type === 'TIME_ENTRY') {
              queryClient.invalidateQueries({ queryKey: ['time-entries'] });
            } else {
              queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
              queryClient.invalidateQueries({ queryKey: ['occurrences'] });
            }
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
  }, [hierarchyKey, accountId, clientId, siteId, siteGroupId, queryClient]);
}
