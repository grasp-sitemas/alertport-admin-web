import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';

/**
 * Backend-persisted onboarding status for the logged-in user.
 * A tour is "done" (don't auto-start) whenever its `*CompletedAt`
 * timestamp is present. `skipped` is a hint for analytics - UX treats
 * it the same as completed.
 */
export interface OnboardingStatus {
  adminCompletedAt?: string;
  operatorCompletedAt?: string;
  skipped?: boolean;
  updatedAt?: string;
}

export type OnboardingTour = 'admin' | 'operator';
export type OnboardingAction = 'completed' | 'skipped';

interface StatusEnvelope {
  status: number;
  result?: OnboardingStatus;
}

interface CompleteEnvelope {
  status: number;
  result?: Partial<OnboardingStatus>;
}

export const onboardingService = {
  async getStatus(): Promise<OnboardingStatus> {
    const { data } = await apiClient.post<StatusEnvelope>(endpoints.onboardingStatus, {});
    return data?.result ?? {};
  },

  async complete(
    tour: OnboardingTour,
    action: OnboardingAction = 'completed',
  ): Promise<void> {
    await apiClient.post<CompleteEnvelope>(endpoints.onboardingComplete, {
      tour,
      action,
    });
  },
};
