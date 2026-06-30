'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { equipmentService } from '@/services/equipment.service';
import { useUserScope, applyUserScope } from '@/hooks/use-user-scope';
import type { Company, Equipment } from '@/types/api';
import { useDevicePresence } from './use-device-presence';

interface OfflineDevicesPanelProps {
  /**
   * Live online socket userIds (account-scoped) from `useCallContext()`’s
   * `onlineUsers`. Pass `undefined` when the chat socket is unavailable —
   * the panel renders nothing in that case (presence is best-effort live
   * data, not historical lastSeen).
   */
  onlineUserIds: readonly string[] | undefined;
}

const EQUIPMENT_PAGE_SIZE = 200;

/**
 * The device registers on ms-chat with `uniqueId` as its socket userId
 * (falling back to `_id`). Mirror that here so presence cross-references
 * correctly. See alertport-app `resolveDeviceIdentity`.
 */
export function devicePresenceId(equipment: Equipment): string | null {
  return equipment.uniqueId || equipment._id || null;
}

/**
 * Race-guard for the equipment presence query. Only fetch when the live
 * presence list is meaningfully populated: `undefined` hides the panel
 * entirely, and an empty array is indeterminate — on first socket connect
 * `onlineUserIds` is briefly `[]` before the server broadcasts `user:list`,
 * so querying then would flag every device as offline momentarily.
 */
export function shouldQueryPresence(onlineUserIds: readonly string[] | undefined): boolean {
  return Array.isArray(onlineUserIds) && onlineUserIds.length > 0;
}

function deviceName(equipment: Equipment): string {
  return equipment.code || equipment.name || equipment.uniqueId || equipment._id;
}

function siteName(equipment: Equipment): string {
  const site = equipment.site as string | Company | undefined;
  if (site && typeof site === 'object') return site.name ?? '';
  return '';
}

/**
 * Collapsible panel listing equipment that is currently offline (known to
 * the account but absent from the live ms-chat presence list).
 *
 * IMPORTANT: this is best-effort *live* presence, not historical. ms-chat
 * keeps no persistent lastSeen, so "offline" means "not connected right
 * now". When the chat socket is unavailable (`onlineUserIds` undefined) the
 * panel renders nothing rather than flagging every device as offline.
 */
export function OfflineDevicesPanel({ onlineUserIds }: OfflineDevicesPanelProps) {
  const t = useTranslations();
  const scope = useUserScope();
  const [open, setOpen] = useState(false);

  const { onlineDeviceIds } = useDevicePresence(onlineUserIds);

  const queryParams = useMemo(
    () => applyUserScope({ skip: 1, limit: EQUIPMENT_PAGE_SIZE, status: 'ACTIVE' }, scope),
    [scope],
  );

  const equipmentQuery = useQuery({
    queryKey: ['equipment', 'presence', queryParams],
    queryFn: () => equipmentService.filter(queryParams),
    // Gate on presence being meaningfully populated (see shouldQueryPresence):
    // `undefined` still hides the panel via the early return below; an empty
    // array is the first-connect race we must not query through.
    enabled: shouldQueryPresence(onlineUserIds),
    staleTime: 60 * 1000,
  });

  const offlineDevices = useMemo(() => {
    const equipment = equipmentQuery.data?.results ?? [];
    return equipment.filter((eq) => {
      const id = devicePresenceId(eq);
      // Only devices with a presence id can be classified.
      if (!id) return false;
      return !onlineDeviceIds.has(id);
    });
  }, [equipmentQuery.data, onlineDeviceIds]);

  // Presence unavailable → hide entirely (best-effort live data only).
  if (onlineUserIds === undefined) return null;

  const count = offlineDevices.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="text-text-muted h-4 w-4" />
            {t('alerts.offlineDevices')}
            {count > 0 && <Badge variant="warning">{count}</Badge>}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="offline-devices-body"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent id="offline-devices-body">
          {equipmentQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : count === 0 ? (
            <p className="text-text-muted text-sm">{t('alerts.offlineDevicesEmpty')}</p>
          ) : (
            <ul className="space-y-1.5" aria-live="polite">
              {offlineDevices.map((eq) => {
                const site = siteName(eq);
                return (
                  <li
                    key={eq._id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2',
                    )}
                  >
                    <span className="truncate text-sm font-medium text-white">
                      {deviceName(eq)}
                    </span>
                    {site && <span className="text-text-muted truncate text-xs">{site}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}
