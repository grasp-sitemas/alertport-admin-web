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

/**
 * Strip `Authorization` and `x-correlation-id` from any object that may
 * carry HTTP headers. AlertPort uses `Authorization: <token>` (no
 * `Bearer` prefix) - Sentry's stock scrubbing pattern targets `Bearer
 * <token>`, so without this hook the literal token would land in
 * breadcrumbs and request snapshots verbatim.
 */
function scrubAuthHeaders(headers: Record<string, unknown> | undefined) {
  if (!headers || typeof headers !== 'object') return;
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === 'authorization' || k.toLowerCase() === 'x-correlation-id') {
      headers[k] = '[Filtered]';
    }
  }
}

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
    // Capped at 0.5 (was 1.0) so a recurring crash loop can't burn the
    // Sentry replay quota in one day. Adjust per quota budget.
    replaysOnErrorSampleRate: 0.5,
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
    beforeBreadcrumb(breadcrumb) {
      // HTTP/fetch breadcrumbs carry `request_headers` / `response_headers`
      // when the SDK's HTTP integration is active. Strip our auth header
      // there before the breadcrumb is queued.
      const data = breadcrumb.data as
        | { request_headers?: Record<string, unknown>; response_headers?: Record<string, unknown> }
        | undefined;
      if (data) {
        scrubAuthHeaders(data.request_headers);
        scrubAuthHeaders(data.response_headers);
      }
      return breadcrumb;
    },
    beforeSend(event) {
      // Final pass: any captured request snapshot can also carry headers.
      const req = event.request as { headers?: Record<string, unknown> } | undefined;
      if (req?.headers) scrubAuthHeaders(req.headers);
      return event;
    },
  });
}

/**
 * Next.js 16 exposes a router-transition hook that Sentry uses to
 * attach span context to client-side navigations. The helper is a
 * no-op when Sentry isn't initialized, so it's always safe to export.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
