import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type {
  SignupRequest,
  SignupSuccess,
  ActivationConfirmRequest,
  ActivationConfirmSuccess,
} from '@/types/signup';

interface ApiSingle<T> {
  status: number;
  result: T;
}

/**
 * Public (unauthenticated) endpoints for self-signup + activation.
 * The apiClient still works for these — the request interceptor silently
 * skips the auth header when there is no session.
 */
export const signupService = {
  async signup(payload: SignupRequest): Promise<SignupSuccess> {
    const { data } = await apiClient.post<ApiSingle<SignupSuccess>>(endpoints.signup, payload);
    return data.result;
  },

  async confirm(payload: ActivationConfirmRequest): Promise<ActivationConfirmSuccess> {
    // Some backends with legacy short-code support upper-case the `code`
    // field, which corrupts base64url tokens. Always prefer the `token`
    // field when present.
    const body: ActivationConfirmRequest = {
      email: payload.email,
      ...(payload.token ? { token: payload.token } : {}),
      ...(payload.code && !payload.token ? { code: payload.code } : {}),
    };
    const { data } = await apiClient.post<ApiSingle<ActivationConfirmSuccess>>(
      endpoints.activationConfirm,
      body,
    );
    return data.result;
  },

  async resend(email: string): Promise<{ email: string }> {
    const { data } = await apiClient.post<ApiSingle<{ email: string }>>(
      endpoints.activationResend,
      { email },
    );
    return data.result;
  },
};
