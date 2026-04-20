import type { NextConfig } from 'next';
import path from 'node:path';

/**
 * Security headers applied to every response.
 *
 * Scope notes:
 *  - `connect-src` must list every origin we fetch/WebSocket to. Today:
 *      * API gateway (HML + PROD Heroku)
 *      * ms-chat (HML + PROD Heroku) over https + wss (Socket.IO)
 *      * Firebase/Firestore (SOS realtime)
 *      * Google APIs (Firebase backfill)
 *      * WebRTC signalling / STUN / TURN (wss + turns:)
 *  - We keep the list permissive enough that HML + PROD + the dev
 *    loopback all work without a CSP-report-only tuning round. If
 *    ops later wants to tighten, reduce to exact hostnames (remove
 *    wildcards) once DNS is stable.
 *  - `frame-ancestors 'none'` prevents the whole admin being
 *    iframed by another origin — cheap clickjacking defence.
 *  - `object-src 'none'` blocks legacy plugins.
 *  - We deliberately allow `'unsafe-inline'` on style (Tailwind JIT
 *    + Radix UI portal styling require it); scripts are NOT allowed
 *    to run inline (`script-src 'self'`).
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Next.js ships some inline bootstrap scripts; `'unsafe-inline'` is
  // the pragmatic choice for the admin panel. Revisit with strict
  // nonce-based CSP if we ever host it under a domain touching PII.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  [
    "connect-src 'self'",
    'https://*.herokuapp.com',
    'wss://*.herokuapp.com',
    'https://*.shieldgo.com.br',
    'wss://*.shieldgo.com.br',
    'https://*.googleapis.com',
    'https://*.firebaseio.com',
    'wss://*.firebaseio.com',
    'https://firebaseinstallations.googleapis.com',
    'https://fcm.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://identitytoolkit.googleapis.com',
    'wss://*.turn.twilio.com',
    'turns:',
    'turn:',
    'stun:',
  ].join(' '),
  // Upgrade mixed content automatically; blocks the last-mile http
  // references that sneak in via user-supplied URLs.
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    // We need microphone (WebRTC calls) and camera/geolocation for the
    // SOS recording + check-in flows. Everything else is denied.
    value: 'camera=(self), microphone=(self), geolocation=(self), payment=()',
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
