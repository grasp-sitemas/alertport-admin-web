'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToAlertportRealtime, type AlertportRealtimeEvent } from './realtime';
import { useUserScope } from '@/hooks/use-user-scope';
import type { PatrolAction } from '@/types/api';

/**
 * Firestore `updateAttendanceEvent/{siteGroupId}` carries the attendance
 * + operator objects as JSON strings (see ms-user ctr-patrol-actions.js).
 * Parse defensively so a mangled payload doesn't break cache patching.
 */
function tryParseJson<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

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
          case 'attendance:close': {
            // Optimistic cache patch: merge the new attendance object into
            // the matching patrol-action row across every `patrol-actions`
            // query in the cache. Critical UX: another operator claiming
            // an event locks the card on this user's screen before the
            // next refetch round-trip, preventing the race where both
            // operators see "Abrir atendimento" for the same event.
            const doc = evt.data as {
              attendance?: string;
              operator?: string;
              patrolActionId?: string;
            };
            const patrolActionId = doc?.patrolActionId;
            const attendance =
              tryParseJson<NonNullable<PatrolAction['attendance']>>(doc?.attendance);
            if (patrolActionId && attendance) {
              const caches = queryClient.getQueriesData<{
                results?: PatrolAction[];
              }>({ queryKey: ['patrol-actions'] });
              for (const [key, value] of caches) {
                if (!value?.results) continue;
                let changed = false;
                const next = value.results.map((row) => {
                  if (row._id !== patrolActionId) return row;
                  changed = true;
                  return { ...row, attendance };
                });
                if (changed) {
                  queryClient.setQueryData(key, { ...value, results: next });
                }
              }
            }
            queryClient.invalidateQueries({ queryKey: ['patrol-actions'] });
            break;
          }
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
