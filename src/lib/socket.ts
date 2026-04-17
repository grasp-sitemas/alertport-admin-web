/**
 * Socket.IO client — ms-chat connection singleton.
 *
 * Preserves the exact configuration, event names and payload shapes used in
 * shieldgo-admin-web/src/config/websocket.js. The server URL comes from
 * NEXT_PUBLIC_MS_CHAT_URL (no hard-coded endpoints).
 */

import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (_socket) return _socket;

  _socket = io(env.chatUrl, {
    transports: ['websocket', 'polling'],
    upgrade: true,
    withCredentials: false,
    timeout: 15000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    autoConnect: true,
  });

  return _socket;
}

export function disconnectSocket(): void {
  if (_socket) {
    try {
      _socket.removeAllListeners();
      _socket.disconnect();
    } finally {
      _socket = null;
    }
  }
}

/** Register the current operator on the chat server. Mirrors legacy `user:register`. */
export interface RegisterUserPayload {
  userId: string;
  accountId?: string;
  role: string;
  clientType: string; // 'ADMIN_MONITOR'
  displayName?: string;
}

export interface StartCallPayload {
  to: string;
  from: string;
  accountId?: string;
  callMode: 'NORMAL' | 'SILENT_LISTEN';
}

export interface StartCallAck {
  ok: boolean;
  error?: string;
  roomId?: string;
  toLabel?: string;
  to?: string;
  targetOnline?: boolean;
  /**
   * When `targetOnline` is false, ms-chat checks whether the user id is
   * registered under a DIFFERENT account and sets this to true — lets the
   * UI distinguish "device app closed" from "device logged into another
   * tenant" (the legacy multi-tenant isolation rule).
   */
  targetOnlineInOtherAccount?: boolean;
  wakeupTriggered?: boolean;
  callRecordingEnabled?: boolean;
}

export interface IncomingCallPayload {
  roomId: string;
  from: string;
  fromLabel?: string;
  fromDisplayName?: string;
  fromClientType?: string;
  fromRole?: string;
  callMode: 'NORMAL' | 'SILENT_LISTEN';
}

export interface WebRtcSignalPayload {
  roomId: string;
  to?: string;
  from?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
