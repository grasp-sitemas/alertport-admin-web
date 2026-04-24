'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  PhoneIncoming,
  Circle,
  StopCircle,
  AlertTriangle,
} from 'lucide-react';
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
import { detectAudioCapture, type CallActions, type CallState } from './use-call';

interface CallDialogProps extends CallState, CallActions {}

const MAX_RECORDING_DURATION_SEC = 180;

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Incoming-call ringtone synthesized with the Web Audio API.
 *
 * Using an oscillator instead of a bundled MP3 keeps the bundle size
 * unchanged and sidesteps asset-hosting on Vercel (no new file in
 * `public/`). The pattern is a classic two-tone ring: alternating 480 Hz
 * and 620 Hz bursts separated by silence — recognizable as "phone
 * ringing" without being as harsh as a single sine wave.
 *
 * Autoplay gotcha: browsers block AudioContext until a user gesture has
 * unlocked audio somewhere on the page. For a fresh tab where the
 * operator hasn't interacted yet, `ctx.state` will be `suspended` and
 * the ring will be silent. That's acceptable — once the operator starts
 * their first call (or any click on the app shell), subsequent incoming
 * calls ring normally. We still attempt `resume()` best-effort here.
 */
function useIncomingRingtone(active: boolean): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef<boolean>(true);

  useEffect(() => {
    if (!active) return;
    if (typeof window === 'undefined') return;

    const AudioCtx: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    stoppedRef.current = false;

    const ensureCtx = (): AudioContext | null => {
      if (ctxRef.current) return ctxRef.current;
      try {
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        return ctx;
      } catch {
        return null;
      }
    };

    const playRing = () => {
      if (stoppedRef.current) return;
      const ctx = ensureCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const pattern: Array<{ freq: number; start: number; duration: number }> = [
        { freq: 480, start: 0, duration: 0.4 },
        { freq: 620, start: 0.45, duration: 0.4 },
      ];

      pattern.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const s = now + start;
        const e = s + duration;
        gain.gain.setValueAtTime(0, s);
        gain.gain.linearRampToValueAtTime(0.18, s + 0.03);
        gain.gain.setValueAtTime(0.18, e - 0.05);
        gain.gain.linearRampToValueAtTime(0, e);
        osc.connect(gain).connect(ctx.destination);
        osc.start(s);
        osc.stop(e + 0.02);
      });
    };

    playRing();
    intervalRef.current = setInterval(playRing, 2200);

    return () => {
      stoppedRef.current = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ctxRef.current) {
        try {
          void ctxRef.current.close();
        } catch {
          /* ignore */
        }
        ctxRef.current = null;
      }
    };
  }, [active]);
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

  // SILENT_LISTEN is auto-accepted — never actually shows the ringing
  // state to the operator. Ringing the tone for it would defeat the
  // whole "discreet listen" purpose, so gate on NORMAL only.
  useIncomingRingtone(isRinging && callDirection === 'incoming' && !isSilent);

  // Detect the runtime's audio-capture capabilities once per mount.
  // If recording is enabled backend-side but the browser can't do it,
  // we show a warning badge so the operator knows live-listen works
  // but no recording file will be produced.
  const capability = useMemo(() => detectAudioCapture(), []);
  const recordingWillWork =
    capability.mediaRecorder && capability.audioContext;
  const showBrowserWarning = canRecord && !recordingWillWork;

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
              <p className="text-lg font-semibold text-white">{peerLabel || '-'}</p>
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
                {showBrowserWarning && (
                  <Badge variant="warning" className="gap-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    {t('calls.recordingUnsupportedBrowser')}
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
                    disabled={!recordingWillWork}
                    aria-label={isRecording ? t('calls.stopRecording') : t('calls.startRecording')}
                    title={
                      !recordingWillWork
                        ? t('calls.recordingUnsupportedBrowser')
                        : isRecording
                          ? t('calls.stopRecording')
                          : t('calls.startRecording')
                    }
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
