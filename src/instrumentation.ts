/**
 * Next.js server-side instrumentation entrypoint.
 *
 * Runs once per Node / Edge runtime boot. We use it to initialize
 * Sentry for the server bundle. Client init lives in
 * `src/instrumentation-client.ts`; both read the same public DSN so
 * the HML and PROD builds are distinguishable by their env var.
 *
 * Fail-closed rule: if NEXT_PUBLIC_SENTRY_DSN is empty (local dev,
 * or a preview without Sentry wired) we skip init entirely so the
 * SDK never tries to ship events to a bad endpoint. The
 * `onRequestError` export is still valid in that case - Sentry's
 * `captureRequestError` is a no-op when the client has not been
 * initialized.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';
// Prefer an explicit Sentry-only env var so HML and PROD surfaces
// can be separated in the Sentry dashboard without coupling to
// `NEXT_PUBLIC_APP_MODE`, which drives unrelated feature flags.
// Falls back to APP_MODE so local dev keeps working.
const environment =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
  process.env.NEXT_PUBLIC_APP_MODE ||
  'development';
const isProduction = process.env.NEXT_PUBLIC_IS_PRODUCTION === 'true';

export async function register() {
  if (!dsn) return;

  const commonOptions = {
    dsn,
    environment,
    // 10% traces in prod keeps Sentry bill predictable; HML captures
    // everything so QA can drill into any request.
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    // The admin panel can surface operator data; never let Sentry
    // capture the entire request body by default.
    sendDefaultPii: false,
  };

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init(commonOptions);
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init(commonOptions);
  }
}

/**
 * Next.js 16 error hook: any error thrown in a Server Component, a
 * Route Handler, or a Server Action is forwarded here. The Sentry
 * helper attaches request context automatically. It safely no-ops
 * when the client was never initialized (empty DSN).
 */
export const onRequestError = Sentry.captureRequestError;
