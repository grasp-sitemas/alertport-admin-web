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
    const { data } = await apiClient.post<ApiSingle<ActivationConfirmSuccess>>(
      endpoints.activationConfirm,
      payload,
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
