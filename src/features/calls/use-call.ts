'use client';

/**
 * useCall — complete call state machine.
 *
 * Replicates the call flow from shieldgo-admin-web/src/pages/Monitor/AlertMonitor/AlertMonitor.vue:
 *
 *   Operator → Device (outgoing):
 *     startCall() → emit('call:start') → create PC + getUserMedia → emit('webrtc:offer')
 *     ← 'call:accept' ← 'webrtc:answer' ← 'webrtc:ice' → connected
 *
 *   Device → Operator (incoming):
 *     ← 'call:incoming' → show modal → accept() → emit('call:accept')
 *     ← 'webrtc:offer' → create PC + getUserMedia → emit('webrtc:answer')
 *     ← 'webrtc:ice' → connected
 *
 * ALL event names, payload shapes and acknowledgement formats are byte-identical
 * to the legacy implementation. Do not rename.
 *
 * Listener registration is guarded against double-registration and always cleaned
 * up on unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSocket, type IncomingCallPayload, type StartCallAck, type WebRtcSignalPayload } from '@/lib/socket';
import { getWebRtcIceServers } from '@/lib/webrtc-ice';
import { useAuth } from '@/hooks/use-auth';

/**
 * Silent-listen recording — transparent, automatic.
 *
 * WebRTC is peer-to-peer: the ms-chat server never sees the actual audio
 * stream. Any "backend recording" actually has to capture audio at an endpoint
 * — here, the operator's browser. The operator UI deliberately exposes NO
 * toggle, no indicator: the recording is started silently when a SILENT_LISTEN
 * call reaches the `connected` state and uploaded when the call ends.
 *
 * Payload shape matches the existing `call:recording:upload` handler in
 * ms-chat/services/callRecordingService.js: base64-encoded WebM blob + roomId
 * + timestamps. Server-side persistence to S3 + Mongo already exists.
 */
function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      // Strip the "data:<mime>;base64," prefix — backend accepts both, but
      // smaller payload is nicer.
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'incoming'
  | 'outgoing'
  | 'connected'
  | 'ended'
  | 'error';

export type CallMode = 'NORMAL' | 'SILENT_LISTEN';

export interface CallState {
  status: CallStatus;
  statusMessage: string;
  socketConnected: boolean;
  /**
   * True once the socket has connected AND the server has ack'd our
   * `user:register`. Consumers that emit other server events (like
   * `call:recordings:list`) should gate on this to avoid NOT_REGISTERED
   * errors during the small window between TCP connect and session
   * registration.
   */
  socketReady: boolean;
  onlineUsers: string[];
  // Active call
  roomId: string | null;
  peerUserId: string | null;
  peerLabel: string | null;
  callMode: CallMode | null;
  callDurationSec: number;
  // Role in the current call
  callDirection: 'incoming' | 'outgoing' | null;
  // Audio element state
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  micMuted: boolean;
  remoteMuted: boolean;
}

export interface CallActions {
  startCall: (params: { to: string; toLabel?: string; callMode: CallMode }) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleRemoteAudio: () => void;
}

export function useCall(): CallState & CallActions {
  const { user } = useAuth();
  const [status, setStatus] = useState<CallStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peerUserId, setPeerUserId] = useState<string | null>(null);
  const [peerLabel, setPeerLabel] = useState<string | null>(null);
  const [callMode, setCallMode] = useState<CallMode | null>(null);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [callDirection, setCallDirection] = useState<'incoming' | 'outgoing' | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOfferRef = useRef<WebRtcSignalPayload | null>(null);
  const pendingIceRef = useRef<WebRtcSignalPayload[]>([]);
  const activeRoomIdRef = useRef<string | null>(null);
  const peerUserIdRef = useRef<string | null>(null);
  const callModeRef = useRef<CallMode | null>(null);
  const initializedRef = useRef(false);

  // Silent-listen transparent recording
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recorderMimeRef = useRef<string>('');
  const recordingStartedAtRef = useRef<Date | null>(null);
  const callRecordingEnabledRef = useRef<boolean>(false);


  const finalizeRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;

    try {
      await new Promise<void>((resolve) => {
        const onStop = () => resolve();
        recorder.addEventListener('stop', onStop, { once: true });
        try {
          if (recorder.state !== 'inactive') recorder.stop();
          else resolve();
        } catch {
          resolve();
        }
      });

      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      if (!chunks.length) return;

      const mimeType = recorderMimeRef.current || 'audio/webm';
      const blob = new Blob(chunks, { type: mimeType });
      if (!blob.size) return;

      const startedAt = recordingStartedAtRef.current;
      const endedAt = new Date();
      const durationSec = startedAt
        ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
        : 0;
      recordingStartedAtRef.current = null;

      const base64 = await blobToBase64(blob);
      const socket = getSocket();
      const accountId =
        typeof user?.account === 'object' && user?.account
          ? user.account._id
          : (user?.account as string | undefined);

      socket.emit('call:recording:upload', {
        roomId: activeRoomIdRef.current,
        accountId,
        callMode: 'SILENT_LISTEN',
        initiatedBy: user?._id,
        peerUserId: peerUserIdRef.current,
        startedAt: startedAt?.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSec,
        mimeType,
        audioBase64: base64,
      });
    } catch {
      // best-effort
    }
  }, [user]);

  const resetCallState = useCallback(() => {
    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    activeRoomIdRef.current = null;
    peerUserIdRef.current = null;
    callModeRef.current = null;

    setRoomId(null);
    setPeerUserId(null);
    setPeerLabel(null);
    setCallMode(null);
    setCallDurationSec(0);
    setCallDirection(null);
    setMicMuted(false);
    setRemoteMuted(false);
  }, []);

  const ensurePeerConnection = useCallback(async (): Promise<RTCPeerConnection> => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers: getWebRtcIceServers() });
    pcRef.current = pc;

    const socket = getSocket();

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const room = activeRoomIdRef.current;
      const peer = peerUserIdRef.current;
      if (!room || !peer) return;
      socket.emit('webrtc:ice', {
        roomId: room,
        to: peer,
        candidate: ev.candidate.toJSON(),
      });
    };

    pc.ontrack = (ev) => {
      const [remoteStream] = ev.streams;
      if (remoteStream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {
          // Autoplay policy may block — user must click page first.
        });
      }
      // Silent-listen: start transparent recording as soon as remote audio
      // arrives. Guarded so we only create the MediaRecorder once per call.
      if (
        remoteStream &&
        callModeRef.current === 'SILENT_LISTEN' &&
        callRecordingEnabledRef.current &&
        !recorderRef.current &&
        typeof MediaRecorder !== 'undefined'
      ) {
        try {
          const mime = pickSupportedMimeType();
          const recorder = mime
            ? new MediaRecorder(remoteStream, { mimeType: mime })
            : new MediaRecorder(remoteStream);
          recorderMimeRef.current = mime || recorder.mimeType || 'audio/webm';
          recordedChunksRef.current = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          recorder.start(1000);
          recorderRef.current = recorder;
          recordingStartedAtRef.current = new Date();
        } catch {
          // Silently drop — recording is best-effort; never break the call.
          recorderRef.current = null;
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (!pcRef.current) return;
      const state = pcRef.current.connectionState;
      if (state === 'connected') {
        setStatus('connected');
        setStatusMessage('Chamada em andamento');
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        // keep legacy behavior — cleanup on final
        if (state === 'failed') {
          setStatus('error');
          setStatusMessage('Falha na conexão de áudio');
        }
      }
    };

    // Get user media (mic)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    // SILENT_LISTEN: lock mic (operator does not transmit)
    if (callModeRef.current === 'SILENT_LISTEN') {
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      setMicMuted(true);
    }

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    return pc;
  }, []);

  const processQueuedSignals = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const socket = getSocket();

    // Handle queued remote offer (incoming call where operator accepted)
    if (pendingOfferRef.current?.sdp) {
      try {
        await pc.setRemoteDescription(pendingOfferRef.current.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', {
          roomId: activeRoomIdRef.current,
          to: peerUserIdRef.current,
          sdp: answer,
        });
      } catch (err) {
        setStatus('error');
        setStatusMessage(`Erro ao responder oferta WebRTC: ${(err as Error).message}`);
      }
      pendingOfferRef.current = null;
    }

    for (const ice of pendingIceRef.current) {
      if (ice.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(ice.candidate));
        } catch {
          /* ignore */
        }
      }
    }
    pendingIceRef.current = [];
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Socket connection & listener lifecycle
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || initializedRef.current) return;
    initializedRef.current = true;

    const socket = getSocket();

    const register = () => {
      const role = user.companyUser?.subtype;
      if (!role) return;

      const accountId =
        typeof user.account === 'object' && user.account
          ? user.account._id
          : (user.account as string | undefined);

      socket.emit(
        'user:register',
        {
          userId: user._id,
          accountId,
          role,
          clientType: 'ADMIN_MONITOR',
          displayName: `${user.firstName} ${user.lastName}`.trim(),
        },
        (ack?: { ok?: boolean; error?: string }) => {
          // Mark the socket as fully ready only after the server ack's the
          // register. Other hooks (recordings list, etc.) gate on this to
          // avoid the NOT_REGISTERED race that flashes on screen while
          // TCP is connected but the session hasn't landed server-side yet.
          if (ack?.ok !== false) {
            setSocketReady(true);
          }
        },
      );
    };

    const onConnect = () => {
      setSocketConnected(true);
      register();
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      setSocketReady(false);
      if (activeRoomIdRef.current) {
        setStatus('ended');
        setStatusMessage('Conexão com o chat foi perdida');
        // Socket is down — upload will fail. Best we can do is drop buffered
        // chunks so we don't leak. The call:end event will reach the server
        // on reconnect (roomId+socket tombstone), so the audit log still has
        // the session, just without audio.
        try {
          recorderRef.current?.stop();
        } catch {
          /* ignore */
        }
        recorderRef.current = null;
        recordedChunksRef.current = [];
        recordingStartedAtRef.current = null;
        resetCallState();
      }
    };

    const onUserList = (payload: { users: string[] }) => {
      setOnlineUsers(Array.isArray(payload?.users) ? payload.users : []);
    };

    const onIncoming = (payload: IncomingCallPayload) => {
      // Only fire if we're idle
      if (activeRoomIdRef.current) return;
      activeRoomIdRef.current = payload.roomId;
      peerUserIdRef.current = payload.from;
      callModeRef.current = payload.callMode;
      callRecordingEnabledRef.current = payload.callMode === 'SILENT_LISTEN';

      setRoomId(payload.roomId);
      setPeerUserId(payload.from);
      setPeerLabel(payload.fromLabel || payload.fromDisplayName || payload.from);
      setCallMode(payload.callMode);
      setCallDirection('incoming');
      setStatus('incoming');
      setStatusMessage('Chamada recebida');
    };

    const onCallAccept = (payload: { roomId: string; userId: string }) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      setStatus('connected');
      setStatusMessage('Chamada em andamento');
      setPeerUserId(payload.userId);
      peerUserIdRef.current = payload.userId;
    };

    const onCallReject = (payload: { roomId: string; userId?: string }) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      setStatus('ended');
      setStatusMessage('Chamada rejeitada');
      void finalizeRecording().finally(() => resetCallState());
    };

    const onCallEnd = (payload: { roomId: string; reason?: string; duration?: number }) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      setStatus('ended');
      setStatusMessage(
        payload.reason
          ? `Chamada encerrada (${payload.reason})`
          : 'Chamada encerrada',
      );
      void finalizeRecording().finally(() => resetCallState());
    };

    const onDurationTick = (payload: { roomId: string; elapsed: number }) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      setCallDurationSec(payload.elapsed);
    };

    const onRemoteOffer = async (payload: WebRtcSignalPayload) => {
      if (payload.roomId !== activeRoomIdRef.current) {
        // Not accepted yet — queue
        pendingOfferRef.current = payload;
        return;
      }
      if (!pcRef.current) {
        pendingOfferRef.current = payload;
        return;
      }
      if (!payload.sdp) return;
      try {
        await pcRef.current.setRemoteDescription(payload.sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('webrtc:answer', {
          roomId: payload.roomId,
          to: payload.from || peerUserIdRef.current,
          sdp: answer,
        });
      } catch (err) {
        setStatus('error');
        setStatusMessage(`Erro WebRTC: ${(err as Error).message}`);
      }
    };

    const onRemoteAnswer = async (payload: WebRtcSignalPayload) => {
      if (!pcRef.current || !payload.sdp) return;
      if (payload.roomId !== activeRoomIdRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(payload.sdp);
      } catch (err) {
        setStatus('error');
        setStatusMessage(`Erro WebRTC: ${(err as Error).message}`);
      }
    };

    const onRemoteIce = async (payload: WebRtcSignalPayload) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      if (!payload.candidate) return;
      if (!pcRef.current || !pcRef.current.remoteDescription) {
        pendingIceRef.current.push(payload);
        return;
      }
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        /* ignore */
      }
    };

    // Prevent double registration on hot reload / strict mode
    socket.off('connect').on('connect', onConnect);
    socket.off('disconnect').on('disconnect', onDisconnect);
    socket.off('user:list').on('user:list', onUserList);
    socket.off('call:incoming').on('call:incoming', onIncoming);
    socket.off('call:accept').on('call:accept', onCallAccept);
    socket.off('call:reject').on('call:reject', onCallReject);
    socket.off('call:end').on('call:end', onCallEnd);
    socket.off('call:duration:tick').on('call:duration:tick', onDurationTick);
    socket.off('webrtc:offer').on('webrtc:offer', onRemoteOffer);
    socket.off('webrtc:answer').on('webrtc:answer', onRemoteAnswer);
    socket.off('webrtc:ice').on('webrtc:ice', onRemoteIce);

    // If the socket is already connected (e.g. reuse from a previous mount),
    // trigger registration asynchronously so the effect body stays side-effect-free.
    if (socket.connected) {
      queueMicrotask(() => onConnect());
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('user:list', onUserList);
      socket.off('call:incoming', onIncoming);
      socket.off('call:accept', onCallAccept);
      socket.off('call:reject', onCallReject);
      socket.off('call:end', onCallEnd);
      socket.off('call:duration:tick', onDurationTick);
      socket.off('webrtc:offer', onRemoteOffer);
      socket.off('webrtc:answer', onRemoteAnswer);
      socket.off('webrtc:ice', onRemoteIce);
      initializedRef.current = false;
    };
  }, [user, resetCallState, finalizeRecording]);

  // ──────────────────────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────────────────────
  const startCall = useCallback<CallActions['startCall']>(
    async ({ to, toLabel, callMode: mode }) => {
      if (!user) {
        setStatus('error');
        setStatusMessage('Usuário não autenticado');
        return;
      }
      if (activeRoomIdRef.current) {
        setStatusMessage('Já existe uma chamada ativa');
        return;
      }

      const socket = getSocket();
      const accountId =
        typeof user.account === 'object' && user.account
          ? user.account._id
          : (user.account as string | undefined);

      callModeRef.current = mode;
      setCallMode(mode);
      setCallDirection('outgoing');
      setStatus('connecting');
      setStatusMessage('Iniciando chamada...');
      setPeerLabel(toLabel || to);

      socket.emit(
        'call:start',
        { to, from: user._id, accountId, callMode: mode },
        async (ack: StartCallAck) => {
          if (!ack?.ok || !ack.roomId) {
            // Translate the server error codes into user-visible messages.
            const errCode = ack?.error || 'UNKNOWN';
            const reason =
              errCode === 'ACCOUNT_MISMATCH'
                ? 'O dispositivo pertence a outra conta.'
                : errCode === 'USER_BUSY'
                  ? 'Você ou o dispositivo já estão em outra chamada.'
                  : errCode === 'MISSING_TARGET'
                    ? 'Destinatário não informado.'
                    : errCode === 'SOCKET_DISCONNECTED'
                      ? 'Conexão com o chat caiu. Tente novamente.'
                      : 'Falha ao iniciar a chamada.';
            setStatus('error');
            setStatusMessage(reason);
            toast.error(reason);
            resetCallState();
            return;
          }

          activeRoomIdRef.current = ack.roomId;
          peerUserIdRef.current = ack.to || to;
          callRecordingEnabledRef.current =
            mode === 'SILENT_LISTEN' && ack.callRecordingEnabled !== false;
          setRoomId(ack.roomId);
          setPeerUserId(ack.to || to);

          if (ack.targetOnline === false) {
            // Cross-tenant diagnostic from ms-chat: the device IS online but
            // on a different account — multi-tenant isolation means the admin
            // can't reach it. Clearer copy so the operator knows to move the
            // device (scan QR on a site of their own account) rather than
            // hunting for a crashed app.
            if (ack.targetOnlineInOtherAccount) {
              const msg =
                'O dispositivo está online, porém registrado em outra empresa/conta. Reconfigure o aplicativo (QR Code) em um local da sua conta.';
              setStatusMessage(msg);
              toast.error(msg);
            } else {
              const msg = ack.wakeupTriggered
                ? 'Dispositivo offline — push de wake-up enviado. Aguarde o dispositivo acordar.'
                : 'Dispositivo offline. Peça ao usuário para abrir o aplicativo e tente novamente.';
              setStatusMessage(msg);
              toast.warning(msg);
            }
          } else {
            setStatus('outgoing');
            setStatusMessage('Chamando...');
          }

          try {
            const pc = await ensurePeerConnection();
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:offer', {
              roomId: ack.roomId,
              to: ack.to || to,
              sdp: offer,
            });
          } catch (err) {
            setStatus('error');
            setStatusMessage(`Erro de mídia: ${(err as Error).message}`);
            resetCallState();
          }
        },
      );
    },
    [user, ensurePeerConnection, resetCallState],
  );

  const acceptCall = useCallback(async () => {
    if (!activeRoomIdRef.current || !user) return;
    const socket = getSocket();
    setStatus('connecting');
    setStatusMessage('Conectando...');

    socket.emit(
      'call:accept',
      { roomId: activeRoomIdRef.current, userId: user._id },
      async (ack: { ok?: boolean; error?: string }) => {
        if (ack?.error) {
          setStatus('error');
          setStatusMessage(ack.error);
          resetCallState();
          return;
        }
        try {
          await ensurePeerConnection();
          await processQueuedSignals();
        } catch (err) {
          setStatus('error');
          setStatusMessage(`Erro de mídia: ${(err as Error).message}`);
          resetCallState();
        }
      },
    );
  }, [user, ensurePeerConnection, processQueuedSignals, resetCallState]);

  const rejectCall = useCallback(() => {
    if (!activeRoomIdRef.current || !user) return;
    const socket = getSocket();
    socket.emit('call:reject', {
      roomId: activeRoomIdRef.current,
      userId: user._id,
    });
    setStatus('ended');
    setStatusMessage('Chamada rejeitada');
    void finalizeRecording().finally(() => resetCallState());
  }, [user, resetCallState, finalizeRecording]);

  const endCall = useCallback(() => {
    if (!activeRoomIdRef.current || !user) return;
    const socket = getSocket();
    socket.emit('call:end', {
      roomId: activeRoomIdRef.current,
      userId: user._id,
    });
    setStatus('ended');
    setStatusMessage('Chamada encerrada');
    void finalizeRecording().finally(() => resetCallState());
  }, [user, resetCallState, finalizeRecording]);

  const toggleMic = useCallback(() => {
    if (callModeRef.current === 'SILENT_LISTEN') return; // mic locked
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMicMuted(next);
  }, [micMuted]);

  const toggleRemoteAudio = useCallback(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setRemoteMuted(audio.muted);
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      resetCallState();
    },
    [resetCallState],
  );

  return {
    status,
    statusMessage,
    socketConnected,
    socketReady,
    onlineUsers,
    roomId,
    peerUserId,
    peerLabel,
    callMode,
    callDurationSec,
    callDirection,
    remoteAudioRef,
    micMuted,
    remoteMuted,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleRemoteAudio,
  };
}
