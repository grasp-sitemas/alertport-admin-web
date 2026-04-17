import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 30_000;
const RETRYABLE_STATUS = [500, 502, 503, 504, 408, 429];

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
  // Don't override Content-Type for FormData — let the browser/Axios set it
  // with the correct boundary. Only set it if it's not already FormData.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Response interceptor: handle 401 and retries
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
    if (!config) return Promise.reject(error);

    // 401 → redirect to login (preserve legacy behavior)
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('alertport_session');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Retry logic
    config._retryCount = config._retryCount || 0;
    if (config._retryCount < MAX_RETRIES && isRetryable(error)) {
      config._retryCount += 1;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return apiClient(config);
    }

    return Promise.reject(error);
  },
);

export { apiClient };
export type { AxiosError };
