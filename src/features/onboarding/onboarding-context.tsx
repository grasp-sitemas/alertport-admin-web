'use client';

/**
 * OnboardingProvider — orchestrates the guided tour (react-joyride v3)
 * for the first-time ADMIN / OPERATOR experience.
 *
 * Responsibilities:
 *  - Fetch backend onboarding status on mount (already-completed
 *    tours never auto-start again).
 *  - Auto-start the correct tour after the shell has fully mounted
 *    and the user has landed on /dashboard or /alerts/monitor.
 *  - Persist completion via onboardingService.complete() so the next
 *    session doesn't ask again.
 *  - Expose `replay()` so the user can re-run the tour from the
 *    header menu — that path does NOT re-persist.
 *  - Stay out of the way: never start while a call is in progress,
 *    an SOS banner is pending, or any modal is open.
 *
 * The Joyride component is mounted lazily so the tour bundle (~50 KB
 * gzip) isn't part of the initial shell — an operator who never
 * opens the tour doesn't download it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import type { EventData, Options, Step, Styles } from 'react-joyride';
import { useAuth } from '@/hooks/use-auth';
import { onboardingService, type OnboardingTour } from '@/services/onboarding.service';
import { getTourSteps, pickTourForRole } from './tours';

// Joyride is a named export in v3; wrap for next/dynamic's default
// export contract.
const Joyride = dynamic(
  () => import('react-joyride').then((mod) => ({ default: mod.Joyride })),
  { ssr: false },
);

interface OnboardingContextValue {
  /** Whether the guided tour is currently visible. */
  isRunning: boolean;
  /** Which tour is active (or null when idle). */
  activeTour: OnboardingTour | null;
  /**
   * Force-replay a tour from scratch. Ignores the persisted
   * completedAt flag. Does NOT re-persist when the user finishes.
   */
  replay: (tour?: OnboardingTour) => void;
  /** Dismiss mid-flight (treated as "skipped" by the backend). */
  skip: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const TOUR_ROUTES = new Set(['/dashboard', '/alerts/monitor']);

/**
 * Brand-matched Joyride styles — mirrors the platform tokens so the
 * tour feels native, not a third-party popover dropped on top.
 */
// v3 split: visual tokens go on `options`, element CSS overrides go on
// `styles`. See node_modules/react-joyride/dist/index.d.cts.
const JOYRIDE_OPTIONS: Partial<Options> = {
  primaryColor: '#B3261E',
  backgroundColor: '#1a2234',
  textColor: '#f8fafc',
  arrowColor: '#1a2234',
  overlayColor: 'rgba(5, 10, 20, 0.72)',
  zIndex: 90,
  showProgress: true,
  buttons: ['back', 'skip', 'primary'],
  overlayClickAction: false,
  blockTargetInteraction: true,
};

const JOYRIDE_STYLES: Partial<Styles> = {
  tooltip: {
    borderRadius: 16,
    padding: 20,
    maxWidth: 420,
    boxShadow: '0 20px 48px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
    color: '#f8fafc',
  },
  tooltipContent: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 1.55,
    textAlign: 'left',
  },
  tooltipFooter: {
    marginTop: 16,
  },
  buttonPrimary: {
    backgroundColor: '#B3261E',
    borderRadius: 10,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
  },
  buttonBack: {
    color: '#94a3b8',
    fontSize: 13,
    marginRight: 8,
  },
  buttonSkip: {
    color: '#94a3b8',
    fontSize: 12,
  },
  buttonClose: {
    color: '#94a3b8',
  },
};

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const { user } = useAuth();
  const pathname = usePathname();

  const [isRunning, setIsRunning] = useState(false);
  const [activeTour, setActiveTour] = useState<OnboardingTour | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedStatus, setCompletedStatus] = useState<{
    admin: boolean;
    operator: boolean;
  } | null>(null);
  // When a replay is running we want Joyride to behave normally but we
  // must NOT re-persist on finish — a user re-running the tour isn't
  // re-confirming anything.
  const replayRef = useRef(false);

  const roleTour = pickTourForRole(user?.companyUser?.subtype);

  // ── Bootstrap: fetch backend status once per session ────────────
  useEffect(() => {
    if (!user) {
      setCompletedStatus(null);
      return;
    }
    let cancelled = false;
    onboardingService
      .getStatus()
      .then((status) => {
        if (cancelled) return;
        setCompletedStatus({
          admin: !!status.adminCompletedAt,
          operator: !!status.operatorCompletedAt,
        });
      })
      .catch(() => {
        // Endpoint may be unavailable (pre-deploy, network). Treat as
        // "already completed" so we never auto-start for an unknown
        // state — avoids accidental tour storms during incidents.
        if (!cancelled) {
          setCompletedStatus({ admin: true, operator: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?._id, user]);

  // ── Auto-start gate ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (!roleTour) return;
    if (!completedStatus) return;
    if (completedStatus[roleTour]) return;
    if (isRunning) return;
    if (!pathname || !TOUR_ROUTES.has(pathname)) return;

    // Don't hijack operators in the middle of something important.
    if (typeof document !== 'undefined') {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (document.querySelector('[data-tour-busy="true"]')) return;
    }

    // Small delay so the shell animations + data fetches settle
    // before the tour draws its first spotlight.
    const id = setTimeout(() => {
      replayRef.current = false;
      setStepIndex(0);
      setActiveTour(roleTour);
      setIsRunning(true);
    }, 700);
    return () => clearTimeout(id);
  }, [user, roleTour, completedStatus, isRunning, pathname]);

  // ── Joyride event callback ──────────────────────────────────────
  const handleCallback = useCallback(
    async (data: EventData) => {
      const { status, type, index, action } = data;

      // Advance/rewind step tracking on step:after + target-not-found.
      if (type === 'step:after' || type === 'error:target_not_found') {
        const nextIndex = action === 'prev' ? index - 1 : index + 1;
        setStepIndex(Math.max(0, nextIndex));
        return;
      }

      const finished = status === 'finished' || status === 'skipped';
      if (!finished) return;

      const tour = activeTour;
      setIsRunning(false);
      setActiveTour(null);
      setStepIndex(0);

      if (!tour) return;
      if (replayRef.current) {
        replayRef.current = false;
        return;
      }

      const result = status === 'skipped' ? 'skipped' : 'completed';
      try {
        await onboardingService.complete(tour, result);
      } catch {
        /* best-effort */
      } finally {
        setCompletedStatus((prev) =>
          prev
            ? { ...prev, [tour]: true }
            : { admin: tour === 'admin', operator: tour === 'operator' },
        );
      }
    },
    [activeTour],
  );

  const replay = useCallback(
    (tour?: OnboardingTour) => {
      const target = tour ?? roleTour ?? 'admin';
      replayRef.current = true;
      setStepIndex(0);
      setActiveTour(target);
      setIsRunning(true);
    },
    [roleTour],
  );

  const skip = useCallback(() => {
    if (!isRunning) return;
    const tour = activeTour;
    setIsRunning(false);
    setActiveTour(null);
    setStepIndex(0);
    if (tour && !replayRef.current) {
      onboardingService.complete(tour, 'skipped').catch(() => {});
      setCompletedStatus((prev) =>
        prev
          ? { ...prev, [tour]: true }
          : { admin: tour === 'admin', operator: tour === 'operator' },
      );
    }
    replayRef.current = false;
  }, [isRunning, activeTour]);

  const steps = useMemo<Step[]>(() => {
    if (!activeTour) return [];
    return getTourSteps(activeTour).map((s) => ({
      target: s.target,
      title: t(s.titleKey),
      content: t(s.contentKey),
      placement: s.placement,
      disableBeacon: s.disableBeacon,
      spotlightPadding: s.spotlightPadding ?? 8,
    }));
  }, [activeTour, t]);

  const value = useMemo<OnboardingContextValue>(
    () => ({ isRunning, activeTour, replay, skip }),
    [isRunning, activeTour, replay, skip],
  );

  // Joyride is loaded dynamically so its props aren't statically
  // inferred by next/dynamic. Cast once here to preserve runtime
  // behaviour without fighting the loader's generic signature.
  const JoyrideAny = Joyride as unknown as React.ComponentType<
    Record<string, unknown>
  >;

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {isRunning && steps.length > 0 && (
        <JoyrideAny
          steps={steps}
          run={isRunning}
          stepIndex={stepIndex}
          continuous
          scrollToFirstStep
          locale={{
            back: t('onboarding.controls.back'),
            close: t('onboarding.controls.close'),
            last: t('onboarding.controls.finish'),
            next: t('onboarding.controls.next'),
            skip: t('onboarding.controls.skip'),
          }}
          options={JOYRIDE_OPTIONS}
          styles={JOYRIDE_STYLES}
          onEvent={handleCallback}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    // Outside the provider (e.g. unit tests) return a no-op.
    return EMPTY;
  }
  return ctx;
}

const EMPTY: OnboardingContextValue = {
  isRunning: false,
  activeTour: null,
  replay: () => {},
  skip: () => {},
};
