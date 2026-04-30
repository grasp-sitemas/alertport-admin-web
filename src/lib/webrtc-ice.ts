/**
 * WebRTC ICE server configuration.
 * Mirrors src/services/webrtcIceConfig.js from shieldgo-admin-web.
 *
 * Priority:
 *   1. NEXT_PUBLIC_WEBRTC_ICE_SERVERS (full JSON array) - takes precedence
 *   2. NEXT_PUBLIC_WEBRTC_TURN_URLS (comma-separated) + TURN_USERNAME + TURN_PASSWORD
 *   3. Always includes default Google STUN
 */

import { env } from '@/config/env';
import { getSocket } from '@/lib/socket';

const DEFAULT_STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };

type IceConfigAck = {
  ok?: boolean;
  iceServers?: RTCIceServer[];
};

type SocketLike = {
  connected?: boolean;
  emit: (event: string, payload: unknown, ack?: (response: IceConfigAck) => void) => void;
};

export function getWebRtcIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [DEFAULT_STUN];

  // 1. Full JSON override
  if (env.webRtcIceServersRaw) {
    try {
      const parsed = JSON.parse(env.webRtcIceServersRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [DEFAULT_STUN, ...parsed];
      }
    } catch {
      // fall through to TURN_URLS handling
    }
  }

  // 2. TURN URLs with shared credentials
  if (env.webRtcTurnUrlsRaw) {
    const urls = env.webRtcTurnUrlsRaw
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length > 0) {
      servers.push({
        urls,
        username: env.webRtcTurnUsername || undefined,
        credential: env.webRtcTurnPassword || undefined,
      });
    }
  }

  return servers;
}

function requestIceServersFromChat(socket: SocketLike | null | undefined): Promise<RTCIceServer[] | null> {
  if (!socket?.connected) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, 1500);

    const finish = (servers: RTCIceServer[] | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(servers);
    };

    try {
      socket.emit('webrtc:ice-config', {}, (ack) => {
        if (ack?.ok && Array.isArray(ack.iceServers) && ack.iceServers.length > 0) {
          finish(ack.iceServers);
          return;
        }
        finish(null);
      });
    } catch {
      finish(null);
    }
  });
}

export async function resolveWebRtcIceServers(socket: SocketLike | null | undefined = getSocket()): Promise<RTCIceServer[]> {
  const fromChat = await requestIceServersFromChat(socket);
  if (fromChat && fromChat.length > 0) {
    return fromChat;
  }

  return getWebRtcIceServers();
}
