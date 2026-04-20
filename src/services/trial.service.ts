import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type {
  TrialContext,
  PlanDefinition,
  TrialHistoryEntry,
  TrialLimits,
  TrialUsage,
  PlanType,
} from '@/types/trial';

interface ApiSingle<T> {
  status: number;
  result: T;
}

interface ApiMany<T> {
  status: number;
  results: T[];
}

export const trialService = {
  /**
   * Principal endpoint - populates the global trial store.
   * Tolerant to 404 / non-existence: callers should fall back to a "no trial" default.
   */
  async getContext(): Promise<TrialContext | null> {
    try {
      const { data } = await apiClient.get<ApiSingle<TrialContext>>(endpoints.trialContext);
      return data?.result ?? null;
    } catch {
      return null;
    }
  },

  async getStatus(): Promise<Partial<TrialContext> | null> {
    try {
      const { data } = await apiClient.get<ApiSingle<Partial<TrialContext>>>(endpoints.trialStatus);
      return data?.result ?? null;
    } catch {
      return null;
    }
  },

  async getHistory(params?: { limit?: number; skip?: number }): Promise<TrialHistoryEntry[]> {
    try {
      const { data } = await apiClient.get<ApiMany<TrialHistoryEntry>>(endpoints.trialHistory, {
        params,
      });
      return data?.results ?? [];
    } catch {
      return [];
    }
  },

  async listPlans(): Promise<PlanDefinition[]> {
    try {
      const { data } = await apiClient.get<ApiMany<PlanDefinition>>(endpoints.planFeatures);
      return data?.results ?? [];
    } catch {
      return [];
    }
  },

  async getLimits(): Promise<{ planType: PlanType; limits: TrialLimits; usage: TrialUsage } | null> {
    try {
      const { data } = await apiClient.get<
        ApiSingle<{ planType: PlanType; limits: TrialLimits; usage: TrialUsage }>
      >(endpoints.planLimits);
      return data?.result ?? null;
    } catch {
      return null;
    }
  },

  async start(body?: { durationDays?: number; reason?: string; force?: boolean; companyId?: string }) {
    const { data } = await apiClient.post<ApiSingle<TrialContext>>(endpoints.trialStart, body ?? {});
    return data?.result ?? null;
  },

  async extend(body?: { days?: number; reason?: string; companyId?: string }) {
    const { data } = await apiClient.post<ApiSingle<TrialContext>>(
      endpoints.trialExtend,
      body ?? {},
    );
    return data?.result ?? null;
  },

  async expire(body?: { reason?: string; companyId?: string }) {
    const { data } = await apiClient.post<ApiSingle<TrialContext>>(
      endpoints.trialExpire,
      body ?? {},
    );
    return data?.result ?? null;
  },

  async convert(body: { planType: PlanType; reason?: string; companyId?: string }) {
    const { data } = await apiClient.post<ApiSingle<TrialContext>>(endpoints.trialConvert, body);
    return data?.result ?? null;
  },
};
