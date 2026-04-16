/**
 * Central env configuration.
 * All sensitive / environment-dependent values go through this module.
 * Nothing hard-coded elsewhere in the codebase.
 */

function required(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  if (typeof window !== 'undefined') {
    // In the browser we warn but don't crash — the user may still need to see a usable UI.
    console.warn(`[env] Missing required env var: ${name}`);
  }
  return '';
}

const CHAT_HOST_ALIAS: Record<string, string> = {
  // Legacy/broken hostname seen in production logs.
  'api-chat.shieldgo.com.br': 'api-chat-hml.shieldgo.com.br',
  // Legacy homolog alias from previous web client.
  'chat-homolog.shieldgo.com.br': 'api-chat-hml.shieldgo.com.br',
};

function normalizeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const mappedHost = CHAT_HOST_ALIAS[parsed.hostname];
    if (mappedHost) parsed.hostname = mappedHost;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

export const env = {
  // ── API ─────────────────────────────────────────────────────────
  apiUrl: required(
    'NEXT_PUBLIC_API_URL',
    process.env.NEXT_PUBLIC_API_URL,
    'https://api-homolog.shieldgo.com.br',
  ),

  // ── Socket / Chat (ms-chat) ─────────────────────────────────────
  chatUrl: required(
    'NEXT_PUBLIC_MS_CHAT_URL',
    process.env.NEXT_PUBLIC_MS_CHAT_URL
      ? normalizeUrl(process.env.NEXT_PUBLIC_MS_CHAT_URL)
      : undefined,
    'https://api-chat-hml.shieldgo.com.br',
  ),

  // ── WebRTC ICE configuration ────────────────────────────────────
  webRtcIceServersRaw: process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS ?? '',
  webRtcTurnUrlsRaw: process.env.NEXT_PUBLIC_WEBRTC_TURN_URLS ?? '',
  webRtcTurnUsername: process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME ?? '',
  webRtcTurnPassword: process.env.NEXT_PUBLIC_WEBRTC_TURN_PASSWORD ?? '',

  // ── Firebase ────────────────────────────────────────────────────
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
  },

  // ── App / Admin ─────────────────────────────────────────────────
  appMode: process.env.NEXT_PUBLIC_APP_MODE ?? 'development',
  isProduction: process.env.NEXT_PUBLIC_IS_PRODUCTION === 'true',
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'pt',
  masterAdminEmails: process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAILS ?? '',

  // ── Observability ───────────────────────────────────────────────
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
};

export function isFirebaseConfigured(): boolean {
  const f = env.firebase;
  return Boolean(f.apiKey && f.projectId && f.appId);
}
