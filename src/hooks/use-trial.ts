'use client';

import { createContext, useContext } from 'react';
import type {
  TrialContext as TrialContextData,
  GatedFeature,
  GatedResource,
  PlanDefinition,
} from '@/types/trial';

export interface TrialContextValue {
  /** Null while loading; a safe "legacy" placeholder once the first fetch fails. */
  context: TrialContextData | null;
  /** True only while the initial fetch is in-flight. */
  isLoading: boolean;
  /** True once we have any context (even a fallback). Use for gating UI. */
  isReady: boolean;
  /** Available plans catalog (fetched lazily by /plan page). */
  plans: PlanDefinition[];
  /** Force-refresh the context (call after a trial action). */
  refresh: () => Promise<void>;
  /** True iff the caller is actively on a trial (any status). */
  isTrial: boolean;
  /** True iff the trial is expired or the backend says read-only. */
  isReadOnly: boolean;
  /** Days until trialEndAt, or null when not trial / unknown. */
  daysRemaining: number | null;
  /**
   * Will a new instance of `resource` fit in the plan's limit?
   * Returns { allowed, reason } - `reason` is a TrialBlockedReason or null.
   * For LEGACY / unlimited / unknown resources: always allows.
   */
  canCreate: (resource: GatedResource, count?: number) => { allowed: boolean; reason: string | null };
  /**
   * Is this plan/feature unlocked?
   */
  canUseFeature: (feature: GatedFeature) => { allowed: boolean; reason: string | null };
}

export const TrialContext = createContext<TrialContextValue | null>(null);

export function useTrial(): TrialContextValue {
  const ctx = useContext(TrialContext);
  if (!ctx) {
    // Safe fallback: outside the provider, never block UI - behave like legacy.
    return LEGACY_FALLBACK;
  }
  return ctx;
}

const LEGACY_FALLBACK: TrialContextValue = {
  context: null,
  isLoading: false,
  isReady: true,
  plans: [],
  refresh: async () => {},
  isTrial: false,
  isReadOnly: false,
  daysRemaining: null,
  canCreate: () => ({ allowed: true, reason: null }),
  canUseFeature: () => ({ allowed: true, reason: null }),
};
