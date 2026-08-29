import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';

type RetryAwareConfig = AxiosRequestConfig & { retry?: boolean };

function serverErrorAdapter(onAttempt: () => void): AxiosAdapter {
  return async (config) => {
    onAttempt();
    const response: AxiosResponse = {
      data: { message: 'temporary failure' },
      status: 500,
      statusText: 'Internal Server Error',
      headers: new AxiosHeaders({ 'retry-after': '0' }),
      config,
    };
    throw new AxiosError('temporary failure', 'ERR_BAD_RESPONSE', config, undefined, response);
  };
}

function timeoutAdapter(onAttempt: () => void): AxiosAdapter {
  return async (config) => {
    onAttempt();
    throw new AxiosError('timeout exceeded', 'ECONNABORTED', config);
  };
}

describe('apiClient retry policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not replay a mutation explicitly marked retry=false', async () => {
    let attempts = 0;

    await expect(
      apiClient.post('/schedule-mutation', {}, {
        retry: false,
        adapter: serverErrorAdapter(() => {
          attempts += 1;
        }),
      } as RetryAwareConfig),
    ).rejects.toThrow('temporary failure');

    expect(attempts).toBe(1);
  });

  it('does not replay retry=false after a timeout with no response', async () => {
    let attempts = 0;
    let caught: AxiosError | undefined;

    try {
      await apiClient.post('/schedule-timeout', {}, {
        retry: false,
        adapter: timeoutAdapter(() => {
          attempts += 1;
        }),
      } as RetryAwareConfig);
    } catch (error) {
      caught = error as AxiosError;
    }

    expect(caught?.code).toBe('ECONNABORTED');
    expect(caught?.response).toBeUndefined();
    expect(attempts).toBe(1);
  });

  it('preserves the existing retry budget when retry is not disabled', async () => {
    let attempts = 0;

    await expect(
      apiClient.get('/retryable-read', {
        adapter: serverErrorAdapter(() => {
          attempts += 1;
        }),
      }),
    ).rejects.toThrow('temporary failure');

    expect(attempts).toBe(3);
  });
});
