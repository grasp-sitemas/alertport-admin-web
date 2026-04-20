import type { Step } from 'react-joyride';

/**
 * Tour content for ADMIN and OPERATOR, authored to match the product
 * spec: admins must discover the "first clients → sites → QR code on
 * the AlertPort app → device linking → only then device appears in
 * schedule picker" journey; operators must learn the full monitor /
 * SOS / attendance / call / recording loop that defines their shift.
 *
 * The `target` values are CSS selectors — we anchor most of them to
 * `data-tour="<slug>"` attributes added on sidebar links, monitor
 * KPI cards, call dialog buttons, etc. When an anchor is missing
 * (e.g. the user is on a different route at that moment) Joyride
 * gracefully centers the tooltip on screen.
 *
 * Translations live in src/messages/*.json under `onboarding.tours.*`.
 */

export interface TourStepI18n {
  target: string;
  titleKey: string;
  contentKey: string;
  placement?: Step['placement'];
  disableBeacon?: boolean;
  spotlightPadding?: number;
}

export const ADMIN_TOUR_STEPS: TourStepI18n[] = [
  {
    target: 'body',
    titleKey: 'onboarding.admin.welcome.title',
    contentKey: 'onboarding.admin.welcome.content',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar-clients"]',
    titleKey: 'onboarding.admin.clients.title',
    contentKey: 'onboarding.admin.clients.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-sites"]',
    titleKey: 'onboarding.admin.sites.title',
    contentKey: 'onboarding.admin.sites.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-sites"]',
    titleKey: 'onboarding.admin.qrcode.title',
    contentKey: 'onboarding.admin.qrcode.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-equipment"]',
    titleKey: 'onboarding.admin.equipment.title',
    contentKey: 'onboarding.admin.equipment.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-collaborators"]',
    titleKey: 'onboarding.admin.collaborators.title',
    contentKey: 'onboarding.admin.collaborators.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-users"]',
    titleKey: 'onboarding.admin.users.title',
    contentKey: 'onboarding.admin.users.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-alertScheduling"]',
    titleKey: 'onboarding.admin.scheduling.title',
    contentKey: 'onboarding.admin.scheduling.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-alertMonitor"]',
    titleKey: 'onboarding.admin.monitor.title',
    contentKey: 'onboarding.admin.monitor.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-timeEntries"]',
    titleKey: 'onboarding.admin.attendance.title',
    contentKey: 'onboarding.admin.attendance.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-callRecordings"]',
    titleKey: 'onboarding.admin.recordings.title',
    contentKey: 'onboarding.admin.recordings.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-reportAdherence"]',
    titleKey: 'onboarding.admin.reports.title',
    contentKey: 'onboarding.admin.reports.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-companySettings"]',
    titleKey: 'onboarding.admin.settings.title',
    contentKey: 'onboarding.admin.settings.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-plan"]',
    titleKey: 'onboarding.admin.plan.title',
    contentKey: 'onboarding.admin.plan.content',
    placement: 'right',
  },
  {
    target: 'body',
    titleKey: 'onboarding.admin.finish.title',
    contentKey: 'onboarding.admin.finish.content',
    placement: 'center',
  },
];

export const OPERATOR_TOUR_STEPS: TourStepI18n[] = [
  {
    target: 'body',
    titleKey: 'onboarding.operator.welcome.title',
    contentKey: 'onboarding.operator.welcome.content',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="sidebar-alertMonitor"]',
    titleKey: 'onboarding.operator.monitor.title',
    contentKey: 'onboarding.operator.monitor.content',
    placement: 'right',
  },
  {
    target: 'body',
    titleKey: 'onboarding.operator.sosGlobal.title',
    contentKey: 'onboarding.operator.sosGlobal.content',
    placement: 'center',
  },
  {
    target: 'body',
    titleKey: 'onboarding.operator.kpis.title',
    contentKey: 'onboarding.operator.kpis.content',
    placement: 'center',
  },
  {
    target: 'body',
    titleKey: 'onboarding.operator.eventCard.title',
    contentKey: 'onboarding.operator.eventCard.content',
    placement: 'center',
  },
  {
    target: 'body',
    titleKey: 'onboarding.operator.attendanceOwner.title',
    contentKey: 'onboarding.operator.attendanceOwner.content',
    placement: 'center',
  },
  {
    target: 'body',
    titleKey: 'onboarding.operator.callActions.title',
    contentKey: 'onboarding.operator.callActions.content',
    placement: 'center',
  },
  {
    target: 'body',
    titleKey: 'onboarding.operator.recording.title',
    contentKey: 'onboarding.operator.recording.content',
    placement: 'center',
  },
  {
    target: '[data-tour="sidebar-callRecordings"]',
    titleKey: 'onboarding.operator.recordingsHistory.title',
    contentKey: 'onboarding.operator.recordingsHistory.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-alertOccurrences"]',
    titleKey: 'onboarding.operator.occurrences.title',
    contentKey: 'onboarding.operator.occurrences.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-timeEntries"]',
    titleKey: 'onboarding.operator.timeEntries.title',
    contentKey: 'onboarding.operator.timeEntries.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-alertScheduling"]',
    titleKey: 'onboarding.operator.scheduling.title',
    contentKey: 'onboarding.operator.scheduling.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-reportSos"]',
    titleKey: 'onboarding.operator.reports.title',
    contentKey: 'onboarding.operator.reports.content',
    placement: 'right',
  },
  {
    target: 'body',
    titleKey: 'onboarding.operator.finish.title',
    contentKey: 'onboarding.operator.finish.content',
    placement: 'center',
  },
];

/**
 * Decide which tour to run for a given user role. Returns `null` when
 * the role shouldn't see any auto tour (MANAGER / AUDITOR). Those
 * users can still replay either tour manually from the header menu.
 */
export function pickTourForRole(
  subtype: string | undefined,
): 'admin' | 'operator' | null {
  if (!subtype) return null;
  if (subtype === 'OPERATOR') return 'operator';
  if (subtype === 'ADMIN' || subtype === 'ADMIN_MASTER' || subtype === 'SUPER_ADMIN_MASTER') {
    return 'admin';
  }
  return null;
}

export function getTourSteps(tour: 'admin' | 'operator'): TourStepI18n[] {
  return tour === 'admin' ? ADMIN_TOUR_STEPS : OPERATOR_TOUR_STEPS;
}
