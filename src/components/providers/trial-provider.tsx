'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrialContext, type TrialContextValue } from '@/hooks/use-trial';
import { trialService } from '@/services/trial.service';
import { useAuth } from '@/hooks/use-auth';
import type {
  TrialContext as TrialContextData,
  GatedFeature,
  GatedResource,
  PlanDefinition,
} from '@/types/trial';

const UNLIMITED_SENTINEL = -1;

function isUnlimited(limit: number | undefined): boolean {
  return limit === undefined || limit === null || limit === UNLIMITED_SENTINEL;
}

/**
 * Hydrates the trial context on mount and whenever the auth user changes.
 * Everything is defensive: if the endpoint 404s, a legacy-like context is
 * returned (isReadOnly=false, everything allowed). This keeps legacy
 * customers - and any environment where the backend hasn't deployed yet -
 * functioning exactly as before.
 */
export function TrialProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [context, setContext] = useState<TrialContextData | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const plansFetchedRef = useRef<boolean>(false);

  const fetchContext = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const ctx = await trialService.getContext();
      setContext(ctx);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Re-fetch whenever identity changes (login/logout/company switch).
    if (isAuthenticated) {
      fetchContext();
    } else {
      setContext(null);
      setHasFetched(false);
      plansFetchedRef.current = false;
    }
  }, [isAuthenticated, user?._id, fetchContext]);

  // Mid-session refresh: re-pull the trial context every 5 minutes AND
  // whenever the tab regains focus. Without this, a trial that expires
  // while the operator is actively using the app keeps the UI happy
  // until the next full-page reload - the operator clicks buttons that
  // silently 403 on the server. 5 min is a good balance between
  // "timely lock-out" and "don't hammer the endpoint".
  useEffect(() => {
    if (!isAuthenticated) return;
    const REFRESH_MS = 5 * 60 * 1000;
    const id = setInterval(() => {
      fetchContext();
    }, REFRESH_MS);
    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchContext();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [isAuthenticated, fetchContext]);

  useEffect(() => {
    // Lazy plan catalog fetch; only after first successful context load.
    if (!hasFetched || plansFetchedRef.current) return;
    plansFetchedRef.current = true;
    trialService.listPlans().then(setPlans).catch(() => setPlans([]));
  }, [hasFetched]);

  const canCreate = useCallback<TrialContextValue['canCreate']>(
    (resource: GatedResource, count = 1) => {
      if (!context) return { allowed: true, reason: null };
      if (context.isReadOnly || context.isExpired) {
        return { allowed: false, reason: 'TRIAL_EXPIRED' };
      }
      const limit = context.limits?.[resource];
      if (isUnlimited(limit)) return { allowed: true, reason: null };
      const used = context.usage?.[resource] ?? 0;
      if (used + count > (limit as number)) {
        return { allowed: false, reason: 'TRIAL_LIMIT_REACHED' };
      }
      return { allowed: true, reason: null };
    },
    [context],
  );

  const canUseFeature = useCallback<TrialContextValue['canUseFeature']>(
    (feature: GatedFeature) => {
      if (!context) return { allowed: true, reason: null };
      if (context.isReadOnly || context.isExpired) {
        return { allowed: false, reason: 'TRIAL_EXPIRED' };
      }
      if (context.features?.[feature] === false) {
        return { allowed: false, reason: 'FEATURE_NOT_AVAILABLE' };
      }
      return { allowed: true, reason: null };
    },
    [context],
  );

  const value = useMemo<TrialContextValue>(
    () => ({
      context,
      isLoading,
      isReady: hasFetched || !isAuthenticated,
      plans,
      refresh: fetchContext,
      isTrial: !!context?.isTrial,
      isReadOnly: !!context?.isReadOnly,
      daysRemaining: context?.daysRemaining ?? null,
      canCreate,
      canUseFeature,
    }),
    [context, isLoading, hasFetched, isAuthenticated, plans, fetchContext, canCreate, canUseFeature],
  );

  return <TrialContext.Provider value={value}>{children}</TrialContext.Provider>;
}
