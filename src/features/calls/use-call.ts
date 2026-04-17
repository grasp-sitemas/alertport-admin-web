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
import {
  createCallRecordingState,
  setCallRecordingPolicy,
  attachStreamToRecording,
  startCallRecording,
  stopCallRecordingAndUpload,
  resetCallRecordingState,
  type CallRecordingState,
} from './call-recording';

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

  // ─── Call recording (account-gated via `callRecordingEnabled` on the
  // server ack). Both the local mic and the remote peer stream are piped
  // into a MediaRecorder and uploaded when the call ends. Essential for
  // SILENT_LISTEN audits.
  const recordingRef = useRef<CallRecordingState>(createCallRecordingState());
  const callAccountRef = useRef<string | null>(null);

  /**
   * Captures a snapshot of the current call identity BEFORE resetCallState
   * clears the refs, stops the MediaRecorder, and uploads the blob via the
   * ms-chat `call:recording:upload` socket event. No-op when the recording
   * state was never started (e.g. call recording disabled for the account).
   * Fully async; callers don't need to await — it runs in the background.
   */
  const finalizeRecordingAndUpload = useCallback(() => {
    const state = recordingRef.current;
    if (!state.mediaRecorder) return;
    const room = activeRoomIdRef.current;
    const peer = peerUserIdRef.current;
    const accountForUpload = callAccountRef.current;
    const mode: CallMode = callModeRef.current ?? 'NORMAL';
    const operatorId = user?._id;
    if (!room || !operatorId) return;
    const socket = getSocket();
    void stopCallRecordingAndUpload(state, socket, {
      roomId: room,
      accountId: accountForUpload,
      callMode: mode,
      initiatedBy: callDirection === 'outgoing' ? operatorId : peer ?? '',
      peerUserId: peer ?? '',
      operatorUserId: operatorId,
      startedAt: state.startedAt ?? undefined,
    }).catch(() => {
      /* upload is best-effort; never crash the UI on a failed save */
    });
  }, [user, callDirection]);

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
    callAccountRef.current = null;

    // Drop any pending recording (if upload finished it's already reset; if
    // not, this makes sure we don't keep the AudioContext open).
    resetCallRecordingState(recordingRef.current);
    recordingRef.current = createCallRecordingState();

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
      // Hook the remote peer stream into the recording graph. Safe no-op
      // when recording is disabled by policy.
      if (remoteStream) {
        attachStreamToRecording(recordingRef.current, remoteStream, 'remote');
      }
    };

    pc.onconnectionstatechange = () => {
      if (!pcRef.current) return;
      const state = pcRef.current.connectionState;
      if (state === 'connected') {
        setStatus('connected');
        setStatusMessage('Chamada em andamento');
        // Kick off the recording the first time the PC reaches "connected".
        // Safe no-op if policy is disabled or recording already active.
        try {
          startCallRecording(recordingRef.current);
        } catch {
          /* ignore */
        }
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

    // Pipe the operator mic into the recording graph too — SILENT_LISTEN
    // keeps the mic enabled=false but the tracks are still there, so the
    // silent track is discarded automatically by the audio graph.
    attachStreamToRecording(recordingRef.current, stream, 'local');

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
        () => {
          /* ignore ack */
        },
      );
    };

    const onConnect = () => {
      setSocketConnected(true);
      register();
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      if (activeRoomIdRef.current) {
        setStatus('ended');
        setStatusMessage('Conexão com o chat foi perdida');
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
      resetCallState();
    };

    const onCallEnd = (payload: { roomId: string; reason?: string; duration?: number }) => {
      if (payload.roomId !== activeRoomIdRef.current) return;
      setStatus('ended');
      setStatusMessage(
        payload.reason
          ? `Chamada encerrada (${payload.reason})`
          : 'Chamada encerrada',
      );
      // Finalize audit recording BEFORE refs are cleared by resetCallState.
      finalizeRecordingAndUpload();
      resetCallState();
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
  }, [user, resetCallState]);

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
          callAccountRef.current = accountId ?? null;
          setRoomId(ack.roomId);
          setPeerUserId(ack.to || to);

          // Apply the account-level recording policy returned by the server.
          setCallRecordingPolicy(recordingRef.current, !!ack.callRecordingEnabled);

          if (ack.targetOnline === false) {
            const msg = ack.wakeupTriggered
              ? 'Dispositivo offline — push de wake-up enviado. Aguarde o dispositivo acordar.'
              : 'Dispositivo offline. Peça ao usuário para abrir o aplicativo e tente novamente.';
            setStatusMessage(msg);
            toast.warning(msg);
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
    resetCallState();
  }, [user, resetCallState]);

  const endCall = useCallback(() => {
    if (!activeRoomIdRef.current || !user) return;
    const socket = getSocket();
    socket.emit('call:end', {
      roomId: activeRoomIdRef.current,
      userId: user._id,
    });
    setStatus('ended');
    setStatusMessage('Chamada encerrada');
    // Finalize audit recording BEFORE refs are cleared.
    finalizeRecordingAndUpload();
    resetCallState();
  }, [user, finalizeRecordingAndUpload, resetCallState]);

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
