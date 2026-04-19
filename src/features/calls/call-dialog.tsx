'use client';

import { useTranslations } from 'next-intl';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Radio, PhoneIncoming, Circle, StopCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CallActions, CallState } from './use-call';

interface CallDialogProps extends CallState, CallActions {}

const MAX_RECORDING_DURATION_SEC = 180;

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function CallDialog(props: CallDialogProps) {
  const t = useTranslations();
  const {
    status,
    statusMessage,
    peerLabel,
    callMode,
    callDurationSec,
    callDirection,
    remoteAudioRef,
    micMuted,
    remoteMuted,
    isRecording,
    recordingDurationSec,
    canRecord,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleRemoteAudio,
    toggleRecording,
  } = props;

  const isOpen =
    status === 'incoming' ||
    status === 'outgoing' ||
    status === 'connecting' ||
    status === 'connected';

  const isRinging = status === 'incoming';
  const isConnected = status === 'connected';
  const isSilent = callMode === 'SILENT_LISTEN';

  return (
    <>
      {/* Remote audio element (always mounted while call is open) */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <Dialog open={isOpen} onOpenChange={() => { /* controlled by call state */ }}>
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {callDirection === 'incoming' ? (
                <PhoneIncoming className="h-5 w-5 text-brand-500" />
              ) : (
                <Phone className="h-5 w-5 text-brand-500" />
              )}
              {isRinging
                ? t('calls.incoming')
                : isConnected
                ? t('calls.inProgress')
                : t('calls.connecting')}
            </DialogTitle>
            <DialogDescription>{statusMessage}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-4 gap-3">
            <div
              className={cn(
                'flex h-24 w-24 items-center justify-center rounded-full border',
                isConnected
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-brand-600/15 border-brand-600/30 text-brand-400 animate-pulse',
              )}
            >
              <Phone className="h-10 w-10" />
            </div>

            <div className="text-center">
              <p className="text-lg font-semibold text-white">{peerLabel || '—'}</p>
              <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                {isSilent && (
                  <Badge variant="warning">
                    <Radio className="h-3 w-3 mr-1" />
                    {t('calls.silentListen')}
                  </Badge>
                )}
                {isConnected && (
                  <Badge variant="success">{formatDuration(callDurationSec)}</Badge>
                )}
                {isRecording && (
                  <Badge variant="danger" className="gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    {t('calls.recording')} {formatDuration(recordingDurationSec)} / {formatDuration(MAX_RECORDING_DURATION_SEC)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {isRinging ? (
              <>
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full h-14 w-14 p-0"
                  onClick={rejectCall}
                  aria-label={t('calls.reject')}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
                <Button
                  size="lg"
                  className="rounded-full h-14 w-14 p-0 bg-emerald-600 hover:bg-emerald-700"
                  onClick={acceptCall}
                  aria-label={t('calls.accept')}
                >
                  <Phone className="h-6 w-6" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={micMuted ? 'destructive' : 'secondary'}
                  size="icon"
                  className="rounded-full h-12 w-12"
                  onClick={toggleMic}
                  disabled={isSilent}
                  aria-label={t('calls.toggleMic')}
                  title={isSilent ? t('calls.micLocked') : undefined}
                >
                  {micMuted || isSilent ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full h-14 w-14 p-0"
                  onClick={endCall}
                  aria-label={t('calls.end')}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>

                <Button
                  variant={remoteMuted ? 'destructive' : 'secondary'}
                  size="icon"
                  className="rounded-full h-12 w-12"
                  onClick={toggleRemoteAudio}
                  aria-label={t('calls.toggleRemote')}
                >
                  {remoteMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>

                {isConnected && canRecord && !isSilent && (
                  <Button
                    variant={isRecording ? 'destructive' : 'secondary'}
                    size="icon"
                    className={cn(
                      'rounded-full h-12 w-12',
                      isRecording && 'ring-2 ring-red-500/70 ring-offset-2 ring-offset-background animate-pulse',
                    )}
                    onClick={toggleRecording}
                    aria-label={isRecording ? t('calls.stopRecording') : t('calls.startRecording')}
                    title={isRecording ? t('calls.stopRecording') : t('calls.startRecording')}
                  >
                    {isRecording ? (
                      <StopCircle className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5 text-red-500 fill-red-500" />
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ChatConnectionBadge({ connected }: { connected: boolean }) {
  const t = useTranslations();
  return (
    <Badge variant={connected ? 'success' : 'muted'}>
      <span
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full mr-1.5',
          connected ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted',
        )}
      />
      {connected ? t('calls.chatConnected') : t('calls.chatDisconnected')}
    </Badge>
  );
}
