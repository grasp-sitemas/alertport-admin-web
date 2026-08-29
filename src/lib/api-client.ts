import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Disable replay for non-idempotent requests such as schedule mutations. */
    retry?: boolean;
  }
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const RETRY_AFTER_MAX_MS = 30_000;
const REQUEST_TIMEOUT = 30_000;
const RETRYABLE_STATUS = [500, 502, 503, 504, 408, 429];

/**
 * Number of consecutive backend failures (5xx, 408, network) we
 * tolerate before broadcasting a `service:unavailable` event. The
 * AppShell listens for it and renders a banner so operators know the
 * spinning wheel isn't their internet - it's us. Two failures in a row
 * rather than one avoids false-positive banners on a single flaky
 * request, while still catching a true outage within seconds.
 */
const UNAVAILABLE_THRESHOLD = 2;

/**
 * Module-scoped failure counters, kept inside a single object so the
 * state can't accidentally diverge across multiple imports of this
 * module (esbuild / Turbopack hot reload paths) and so the surface is
 * obvious to anyone reading the interceptor.
 */
const failureState = {
  consecutiveFailures: 0,
  consecutiveAuthFailures: 0,
  unavailableBroadcast: false,
};

function dispatchServiceEvent(kind: 'unavailable' | 'restored') {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(`service:${kind}`));
  } catch {
    /* ignore */
  }
}

function onRequestSuccess() {
  failureState.consecutiveFailures = 0;
  failureState.consecutiveAuthFailures = 0;
  if (failureState.unavailableBroadcast) {
    failureState.unavailableBroadcast = false;
    dispatchServiceEvent('restored');
  }
}

function onRequestFailure(error: AxiosError) {
  // Count 5xx + network errors (4xx are user/client issues - not the
  // platform being down). 401 is handled separately - we still want
  // the banner if 401s come together with 5xx (a bad gateway can
  // return spurious 401s during an outage).
  const status = error.response?.status;
  const isServerOrNetwork =
    !error.response ||
    (typeof status === 'number' && status >= 500) ||
    status === 408 ||
    status === 429;
  if (!isServerOrNetwork) return;
  failureState.consecutiveFailures += 1;
  if (
    failureState.consecutiveFailures >= UNAVAILABLE_THRESHOLD &&
    !failureState.unavailableBroadcast
  ) {
    failureState.unavailableBroadcast = true;
    dispatchServiceEvent('unavailable');
  }
}

function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('alertport_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.token ?? null;
  } catch {
    return null;
  }
}

function getCorrelationId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('alertport_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.correlationId ?? null;
  } catch {
    return null;
  }
}

function isRetryable(error: AxiosError): boolean {
  if (!error.response) return true; // network error
  return RETRYABLE_STATUS.includes(error.response.status);
}

/**
 * Honor `Retry-After` (RFC 7231) on 429/503. Accepts both seconds
 * and HTTP-date formats. Falls back to the linear default delay so
 * the existing retry budget is preserved when the header is missing.
 * Capped at RETRY_AFTER_MAX_MS so a malicious / buggy backend can't
 * stall the UI for hours.
 */
function resolveRetryDelay(error: AxiosError): number {
  const header = error.response?.headers?.['retry-after'];
  if (typeof header !== 'string' && typeof header !== 'number') return RETRY_DELAY;
  const raw = String(header).trim();
  const asInt = Number(raw);
  if (Number.isFinite(asInt) && asInt >= 0) {
    return Math.min(asInt * 1000, RETRY_AFTER_MAX_MS);
  }
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) {
    const ms = asDate - Date.now();
    if (ms > 0) return Math.min(ms, RETRY_AFTER_MAX_MS);
  }
  return RETRY_DELAY;
}

/**
 * Default 401 handler: clear the local session and bounce to /login.
 * Exposed so the dispatched `session:expired` event can call it from
 * the SessionExpiredOverlay (e.g. after the operator confirms they
 * want to reauthenticate). The overlay can also choose to skip the
 * redirect and let the user wrap up something in flight.
 */
function destroyLocalSessionAndRedirect() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('alertport_session');
  } catch {
    /* ignore */
  }
  // Preserve the path the user was on so login can bounce them back.
  try {
    const here = window.location.pathname + window.location.search;
    if (here && here !== '/login') {
      sessionStorage.setItem('alertport_login_return', here);
    }
  } catch {
    /* ignore */
  }
  window.location.href = '/login';
}

function handleAuthExpiry() {
  if (typeof window === 'undefined') return;
  failureState.consecutiveAuthFailures += 1;
  // If auth failures coincide with a confirmed outage, the 401 is
  // most likely a bad-gateway artifact. Surface the unavailable banner
  // so the operator isn't dumped into /login mid-incident.
  if (
    failureState.consecutiveAuthFailures >= UNAVAILABLE_THRESHOLD &&
    !failureState.unavailableBroadcast
  ) {
    failureState.unavailableBroadcast = true;
    dispatchServiceEvent('unavailable');
  }

  // Give a UI listener (SessionExpiredOverlay) a chance to intercept
  // and present a non-destructive modal (e.g. "Sua sessão expirou.
  // Reconectar?"). If no listener calls preventDefault(), fall back to
  // the legacy hard redirect so behavior remains identical.
  let intercepted = false;
  try {
    const ev = new CustomEvent('session:expired', {
      cancelable: true,
      detail: { proceed: destroyLocalSessionAndRedirect },
    });
    intercepted = !window.dispatchEvent(ev); // dispatch returns false iff preventDefault was called
  } catch {
    intercepted = false;
  }
  if (!intercepted) destroyLocalSessionAndRedirect();
}

const apiClient: AxiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: inject auth headers
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getSessionToken();
  if (token) {
    config.headers.Authorization = token;
  }
  const correlationId = getCorrelationId();
  if (correlationId) {
    config.headers['x-correlation-id'] = correlationId;
  }
  // Don't override Content-Type for FormData - let the browser/Axios set it
  // with the correct boundary. Only set it if it's not already FormData.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Response interceptor: handle 401 and retries
apiClient.interceptors.response.use(
  (response) => {
    onRequestSuccess();
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
    if (!config) {
      onRequestFailure(error);
      return Promise.reject(error);
    }

    // 401 → expire session (with UI bridge — see handleAuthExpiry).
    if (error.response?.status === 401) {
      handleAuthExpiry();
      return Promise.reject(error);
    }

    // Retry logic
    config._retryCount = config._retryCount || 0;
    if (config.retry !== false && config._retryCount < MAX_RETRIES && isRetryable(error)) {
      config._retryCount += 1;
      const delay = resolveRetryDelay(error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(config);
    }

    onRequestFailure(error);
    return Promise.reject(error);
  },
);

export { apiClient };
export type { AxiosError };
