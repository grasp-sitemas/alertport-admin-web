'use client';

import { useTranslations } from 'next-intl';
import { Radio } from 'lucide-react';
import { useCallContext } from './call-context';

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Top-of-page banner that stays pinned while the operator is actively in a
 * silent-listen call. Gives context even when the call dialog is backgrounded
 * or the operator navigates to `/alerts/recordings` mid-call.
 */
export function SilentListenBanner() {
  const t = useTranslations();
  const call = useCallContext();

  if (!call) return null;
  const isSilentConnected =
    call.callMode === 'SILENT_LISTEN' &&
    (call.status === 'connected' || call.status === 'outgoing' || call.status === 'connecting');

  if (!isSilentConnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-2 border-b border-amber-500/30 bg-amber-500/10 text-amber-100"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
      </span>
      <Radio className="h-4 w-4 shrink-0 text-amber-300" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {t('calls.silentListenBanner.title')}
          {call.peerLabel ? ` - ${call.peerLabel}` : ''}
        </p>
        <p className="text-xs text-amber-200/80 truncate">
          {t('calls.silentListenBanner.description')}
          {' · '}
          {t('calls.silentListenBanner.autoEndNotice')}
        </p>
      </div>
      {call.status === 'connected' ? (
        <span className="text-xs font-mono tabular-nums text-amber-200/90 shrink-0">
          {formatDuration(call.callDurationSec)} / 03:00
        </span>
      ) : null}
    </div>
  );
}
