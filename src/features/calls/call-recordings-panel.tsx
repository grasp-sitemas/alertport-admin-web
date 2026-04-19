'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play, RefreshCw, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCallRecordings, type RecordingsFilter } from './use-call-recordings';

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Localized label for a recording's call mode. Keeps the wire-level enum
 * ('SILENT_LISTEN' / 'NORMAL') out of the UI — the server contract stays
 * stable but the operator never sees the raw token.
 */
function mapCallModeKey(mode: string | undefined): string {
  if (mode === 'SILENT_LISTEN') return 'calls.mode.silentListen';
  if (mode === 'NORMAL') return 'calls.mode.normal';
  return 'calls.mode.unknown';
}

/**
 * Translate server error codes into i18n keys. Anything the server could
 * plausibly send should have a friendly copy; unknown codes fall back to the
 * generic error message so we never render a raw code like NOT_REGISTERED.
 */
function mapRecordingErrorKey(code: string): string {
  switch (code) {
    case 'FORBIDDEN':
      return 'calls.recordings.errors.forbidden';
    case 'INVALID_ACCOUNT_ID':
    case 'INVALID_RECORDING_ID':
      return 'calls.recordings.errors.invalidInput';
    case 'S3_BUCKET_NOT_CONFIGURED':
    case 'RECORDING_HAS_NO_KEY':
    case 'NOT_FOUND':
      return 'calls.recordings.errors.unavailable';
    default:
      return 'calls.recordings.errors.generic';
  }
}

interface Props {
  /** Full filter object. Defaults to limit=50 when no other fields are set. */
  filter?: RecordingsFilter;
  /** Shortcut for `{ roomId }` — kept for callers embedding the panel inline. */
  roomId?: string;
  /** Shortcut for `{ limit }`. */
  limit?: number;
  /** Hide the "Gravações" heading (useful when the page already owns the title). */
  hideTitle?: boolean;
}

/**
 * Read-only list of silent-listen recordings for the current operator's
 * account. Clicking Play fetches a short-lived signed S3 URL and streams it
 * inline — no download buttons, consistent with the legacy monitor UX.
 */
export function CallRecordingsPanel({ filter, roomId, limit = 50, hideTitle = false }: Props) {
  const t = useTranslations();
  // Merge shorthand props into the filter object. When `filter` is supplied
  // it wins; roomId/limit are handy for existing call-sites that don't need
  // the full filter payload.
  const effectiveFilter: RecordingsFilter = {
    limit,
    ...(roomId ? { roomId } : {}),
    ...filter,
  };
  const {
    recordings,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    getSignedUrl,
  } = useCallRecordings(effectiveFilter);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const handlePlay = async (id: string) => {
    setPlayingId(id);
    setPlayingUrl(null);
    const url = await getSignedUrl(id);
    if (url) setPlayingUrl(url);
    else setPlayingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {hideTitle ? (
          <span />
        ) : (
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Mic className="h-4 w-4 text-brand-500" />
            {t('calls.recordings.title')}
          </h3>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {loading && recordings.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">
          {t(mapRecordingErrorKey(error))}
        </p>
      )}

      {!loading && recordings.length === 0 && (
        <p className="text-sm text-text-muted py-4 text-center">
          {t('calls.recordings.empty')}
        </p>
      )}

      {recordings.length > 0 && (
        <div className="space-y-2">
          {recordings.map((r) => (
            <div
              key={r._id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {formatDuration(r.durationSec)} · {formatBytes(r.bytes)} · {t(mapCallModeKey(r.callMode))}
                    {r.siteName ? ` · ${r.siteName}` : ''}
                    {r.peerLabel ? ` · ${r.peerLabel}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handlePlay(r._id)}
                  disabled={playingId === r._id && !playingUrl}
                >
                  <Play className="h-4 w-4" />
                  {t('calls.recordings.play')}
                </Button>
              </div>
              {playingId === r._id && playingUrl && (
                <audio src={playingUrl} controls autoPlay className="w-full">
                  <track kind="captions" />
                </audio>
              )}
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? <Spinner size="sm" /> : null}
                {t('calls.recordings.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
