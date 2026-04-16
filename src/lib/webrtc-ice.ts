/**
 * WebRTC ICE server configuration.
 * Mirrors src/services/webrtcIceConfig.js from shieldgo-admin-web.
 *
 * Priority:
 *   1. NEXT_PUBLIC_WEBRTC_ICE_SERVERS (full JSON array) — takes precedence
 *   2. NEXT_PUBLIC_WEBRTC_TURN_URLS (comma-separated) + TURN_USERNAME + TURN_PASSWORD
 *   3. Always includes default Google STUN
 */

import { env } from '@/config/env';

const DEFAULT_STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };

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
