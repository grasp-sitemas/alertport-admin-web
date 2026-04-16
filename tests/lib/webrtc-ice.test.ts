import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getWebRtcIceServers } from '@/lib/webrtc-ice';

describe('getWebRtcIceServers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    delete process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS;
    delete process.env.NEXT_PUBLIC_WEBRTC_TURN_URLS;
    delete process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME;
    delete process.env.NEXT_PUBLIC_WEBRTC_TURN_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns at minimum the default Google STUN server', () => {
    const servers = getWebRtcIceServers();
    expect(servers.length).toBeGreaterThanOrEqual(1);
    const stun = servers.find((s) =>
      Array.isArray(s.urls) ? s.urls.includes('stun:stun.l.google.com:19302') : s.urls === 'stun:stun.l.google.com:19302',
    );
    expect(stun).toBeTruthy();
  });
});
