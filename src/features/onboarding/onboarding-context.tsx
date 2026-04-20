'use client';

/**
 * OnboardingProvider - orchestrates the guided tour (react-joyride v3)
 * for the first-time ADMIN / OPERATOR experience.
 *
 * Responsibilities:
 *  - Fetch backend onboarding status on mount (already-completed
 *    tours never auto-start again).
 *  - Auto-start the correct tour after the shell has fully mounted
 *    and the user has landed on /dashboard or /alerts/monitor.
 *  - Route-aware stepping: navigate to the step's route before
 *    rendering so the spotlight lands on a real component.
 *  - Persist completion via onboardingService.complete() so the next
 *    session doesn't ask again.
 *  - Yield to real emergencies: if an SOS banner appears or a call
 *    becomes active mid-tour, dismiss the overlay immediately so the
 *    operator can handle the event. We mark the tour as "skipped" so
 *    it won't auto-start again; the user can replay from the header
 *    menu when the shift settles.
 *  - Expose `replay()` (no-persist) for the header menu, and `skip()`
 *    for manual dismissal.
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
import { usePathname, useRouter } from 'next/navigation';
import type { EventData, Options, Step, Styles } from 'react-joyride';
import { useAuth } from '@/hooks/use-auth';
import { useCallContext } from '@/features/calls/call-context';
import { useSosNotifications } from '@/features/alerts/sos-notification-context';
import { onboardingService, type OnboardingTour } from '@/services/onboarding.service';
import { getTourSteps, pickTourForRole, type TourStepI18n } from './tours';

const Joyride = dynamic(
  () => import('react-joyride').then((mod) => ({ default: mod.Joyride })),
  { ssr: false },
);

interface OnboardingContextValue {
  isRunning: boolean;
  activeTour: OnboardingTour | null;
  replay: (tour?: OnboardingTour) => void;
  skip: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const TOUR_ROUTES = new Set(['/dashboard', '/alerts/monitor']);

// Call statuses that count as a live emergency / active session and
// therefore demand the tour get out of the way.
const ACTIVE_CALL_STATUSES = new Set(['incoming', 'outgoing', 'connecting', 'connected']);

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
  targetWaitTimeout: 4000,
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
    color: '#ffffff',
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
  const router = useRouter();
  const call = useCallContext();
  const { notifications } = useSosNotifications();

  const [isRunning, setIsRunning] = useState(false);
  const [activeTour, setActiveTour] = useState<OnboardingTour | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedStatus, setCompletedStatus] = useState<{
    admin: boolean;
    operator: boolean;
  } | null>(null);

  // Replay runs must never re-persist: the user already finished the
  // tour once, replay is just a refresher.
  const replayRef = useRef(false);
  // Guard against double-persist within a single run. Joyride can
  // fire status=finished AND our step:after last-step path in the
  // same microtask; first successful persist flips this.
  const persistedRef = useRef(false);

  const roleTour = pickTourForRole(user?.companyUser?.subtype);

  // ── Bootstrap: fetch backend status once per session ────────────
  useEffect(() => {
    if (!user) {
      // Reset on logout is an external-state sync, not a cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        if (!cancelled) {
          setCompletedStatus({ admin: true, operator: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?._id, user]);

  // Single exit point for a tour run: clears state, optionally
  // persists the outcome. Idempotent within one run.
  const finishRun = useCallback(
    async (tour: OnboardingTour, result: 'completed' | 'skipped') => {
      setIsRunning(false);
      setActiveTour(null);
      setStepIndex(0);

      if (replayRef.current) {
        replayRef.current = false;
        return;
      }
      if (persistedRef.current) return;
      persistedRef.current = true;

      try {
        await onboardingService.complete(tour, result);
      } catch {
        /* best-effort: backend may be unavailable during incidents */
      }
      setCompletedStatus((prev) =>
        prev
          ? { ...prev, [tour]: true }
          : { admin: tour === 'admin', operator: tour === 'operator' },
      );
    },
    [],
  );

  // ── Auto-start gate ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (!roleTour) return;
    if (!completedStatus) return;
    if (completedStatus[roleTour]) return;
    if (isRunning) return;
    if (!pathname || !TOUR_ROUTES.has(pathname)) return;

    // Don't hijack an operator who is responding to a real event.
    if (call && ACTIVE_CALL_STATUSES.has(call.status)) return;
    if (notifications.some((n) => !n.acknowledged)) return;

    if (typeof document !== 'undefined') {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (document.querySelector('[data-tour-busy="true"]')) return;
    }

    const id = setTimeout(() => {
      replayRef.current = false;
      persistedRef.current = false;
      setStepIndex(0);
      setActiveTour(roleTour);
      setIsRunning(true);
    }, 700);
    return () => clearTimeout(id);
  }, [user, roleTour, completedStatus, isRunning, pathname, call, notifications]);

  // ── Emergency yield ────────────────────────────────────────────
  // If an SOS fires or a call becomes active while the tour is
  // running, bail out immediately. Mark the tour as skipped so it
  // doesn't auto-start again next login; the user can replay from
  // the header menu when calm.
  useEffect(() => {
    if (!isRunning || !activeTour) return;
    const hasLiveSos = notifications.some((n) => !n.acknowledged);
    const callActive = !!call && ACTIVE_CALL_STATUSES.has(call.status);
    if (hasLiveSos || callActive) {
      // Intentional: responding to external state (SOS/call) by
      // tearing down the tour overlay. This is the whole point of
      // the effect - an emergency must not wait for the next render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      finishRun(activeTour, 'skipped');
    }
  }, [isRunning, activeTour, notifications, call, finishRun]);

  // Route-aware stepping: navigate before rendering the next step.
  const routeToStepIfNeeded = useCallback(
    (steps: TourStepI18n[], nextIndex: number) => {
      const step = steps[nextIndex];
      if (!step?.route) return;
      if (typeof window === 'undefined') return;
      if (window.location.pathname === step.route) return;
      router.push(step.route);
    },
    [router],
  );

  // ── Joyride event callback ──────────────────────────────────────
  const handleCallback = useCallback(
    async (data: EventData) => {
      const { status, type, index, action } = data;

      if (type === 'step:after' || type === 'error:target_not_found') {
        const tour = activeTour;
        if (!tour) return;
        const tourSteps = getTourSteps(tour);
        const nextIndex = action === 'prev' ? index - 1 : index + 1;
        const clamped = Math.max(0, nextIndex);

        if (clamped >= tourSteps.length) {
          // User clicked "Finish" on the last step. Persist now:
          // waiting for tour:end can race with an SOS dialog mount
          // and leave the overlay stuck without persistence.
          await finishRun(tour, 'completed');
          return;
        }

        routeToStepIfNeeded(tourSteps, clamped);
        setStepIndex(clamped);
        return;
      }

      if (status === 'finished' || status === 'skipped') {
        const tour = activeTour;
        if (!tour) return;
        const result = status === 'skipped' ? 'skipped' : 'completed';
        await finishRun(tour, result);
      }
    },
    [activeTour, finishRun, routeToStepIfNeeded],
  );

  const replay = useCallback(
    (tour?: OnboardingTour) => {
      // Role-lock: an operator can never be forced into the admin tour
      // from the header menu, and vice-versa. Fall back to the
      // requested tour only when no role tour is available (tests).
      const target = roleTour ?? tour ?? 'admin';
      const tourSteps = getTourSteps(target);
      const firstRoute = tourSteps[0]?.route;
      if (
        firstRoute &&
        typeof window !== 'undefined' &&
        window.location.pathname !== firstRoute
      ) {
        router.push(firstRoute);
      }
      replayRef.current = true;
      persistedRef.current = false;
      setStepIndex(0);
      setActiveTour(target);
      setIsRunning(true);
    },
    [roleTour, router],
  );

  const skip = useCallback(() => {
    if (!isRunning || !activeTour) return;
    finishRun(activeTour, 'skipped');
  }, [isRunning, activeTour, finishRun]);

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
            nextWithProgress: t('onboarding.controls.nextWithProgress'),
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
