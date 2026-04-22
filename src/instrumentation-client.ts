/**
 * Next.js client-side instrumentation entrypoint.
 *
 * Runs before the app becomes interactive. We use it to initialize
 * the Sentry browser SDK with conservative defaults tuned for an
 * admin console (errors always captured, replays only on error,
 * PII redacted).
 *
 * Mirrors the fail-closed rule of the server instrumentation: empty
 * DSN -> no init, no network calls.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

if (dsn) {
  Sentry.init({
    dsn,
    // Same resolution as the server instrumentation: prefer an
    // explicit Sentry env tag; fall back to APP_MODE; then
    // development. Keeps HML / PROD cleanly separated in Sentry UI.
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
      process.env.NEXT_PUBLIC_APP_MODE ||
      'development',
    // Match the server sampling so a full trace lines up end-to-end.
    tracesSampleRate: process.env.NEXT_PUBLIC_IS_PRODUCTION === 'true' ? 0.1 : 1.0,
    // Session replay: OFF for the happy path (the admin shows
    // operator data we don't want to stream to Sentry by default),
    // but ON when an error fires so we can reconstruct the last ~30s
    // and see what the operator clicked before the crash.
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        // Mask everything: operator names, client/site names, free-
        // text notes, chat labels, etc. Anyone with Sentry access
        // sees only the DOM skeleton, not the data.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    sendDefaultPii: false,
  });
}

/**
 * Next.js 16 exposes a router-transition hook that Sentry uses to
 * attach span context to client-side navigations. The helper is a
 * no-op when Sentry isn't initialized, so it's always safe to export.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
