import type { Step } from 'react-joyride';

/**
 * Premium route-aware tours for ADMIN and OPERATOR. Each step can
 * pin itself to a route; the provider navigates the user there and
 * waits for the anchor to mount before spotlighting it.
 *
 * Anchors are live DOM elements marked with `data-tour="<slug>"` so
 * the spotlight always lands on a real component, never on an empty
 * area. When the target is conceptual (SOS banner, journey story)
 * we deliberately place the tooltip in the center.
 */

export interface TourStepI18n {
  target: string;
  titleKey: string;
  contentKey: string;
  placement?: Step['placement'];
  disableBeacon?: boolean;
  spotlightPadding?: number;
  /**
   * Route this step lives on. When set, the provider routes the
   * user here before showing the step. Omit for steps that are
   * centered and have no DOM anchor.
   */
  route?: string;
}

// ── ADMIN tour: full onboarding of the platform journey ──────────
export const ADMIN_TOUR_STEPS: TourStepI18n[] = [
  {
    target: 'body',
    route: '/dashboard',
    titleKey: 'onboarding.admin.welcome.title',
    contentKey: 'onboarding.admin.welcome.content',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="dashboard-kpis"]',
    route: '/dashboard',
    titleKey: 'onboarding.admin.dashboard.title',
    contentKey: 'onboarding.admin.dashboard.content',
    placement: 'bottom',
    spotlightPadding: 12,
  },
  {
    target: '[data-tour="sidebar-clients"]',
    route: '/dashboard',
    titleKey: 'onboarding.admin.clientsMenu.title',
    contentKey: 'onboarding.admin.clientsMenu.content',
    placement: 'right',
  },
  {
    target: '[data-tour="page-clients-create"]',
    route: '/clients',
    titleKey: 'onboarding.admin.clientsCreate.title',
    contentKey: 'onboarding.admin.clientsCreate.content',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sidebar-sites"]',
    route: '/clients',
    titleKey: 'onboarding.admin.sitesMenu.title',
    contentKey: 'onboarding.admin.sitesMenu.content',
    placement: 'right',
  },
  {
    target: '[data-tour="page-sites-create"]',
    route: '/sites',
    titleKey: 'onboarding.admin.sitesCreate.title',
    contentKey: 'onboarding.admin.sitesCreate.content',
    placement: 'bottom',
  },
  {
    target: 'body',
    route: '/sites',
    titleKey: 'onboarding.admin.qrcode.title',
    contentKey: 'onboarding.admin.qrcode.content',
    placement: 'center',
  },
  {
    target: '[data-tour="sidebar-equipment"]',
    route: '/sites',
    titleKey: 'onboarding.admin.equipmentMenu.title',
    contentKey: 'onboarding.admin.equipmentMenu.content',
    placement: 'right',
  },
  {
    target: '[data-tour="page-equipment-create"]',
    route: '/equipment',
    titleKey: 'onboarding.admin.equipmentCreate.title',
    contentKey: 'onboarding.admin.equipmentCreate.content',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sidebar-collaborators"]',
    route: '/equipment',
    titleKey: 'onboarding.admin.collaborators.title',
    contentKey: 'onboarding.admin.collaborators.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-users"]',
    route: '/equipment',
    titleKey: 'onboarding.admin.users.title',
    contentKey: 'onboarding.admin.users.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-alertScheduling"]',
    route: '/equipment',
    titleKey: 'onboarding.admin.schedulingMenu.title',
    contentKey: 'onboarding.admin.schedulingMenu.content',
    placement: 'right',
  },
  {
    target: '[data-tour="scheduling-calendar"]',
    route: '/alerts/scheduling',
    titleKey: 'onboarding.admin.schedulingCalendar.title',
    contentKey: 'onboarding.admin.schedulingCalendar.content',
    placement: 'top',
    spotlightPadding: 12,
  },
  {
    target: '[data-tour="sidebar-alertMonitor"]',
    route: '/alerts/scheduling',
    titleKey: 'onboarding.admin.monitor.title',
    contentKey: 'onboarding.admin.monitor.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-timeEntries"]',
    route: '/alerts/scheduling',
    titleKey: 'onboarding.admin.attendance.title',
    contentKey: 'onboarding.admin.attendance.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-callRecordings"]',
    route: '/alerts/scheduling',
    titleKey: 'onboarding.admin.recordings.title',
    contentKey: 'onboarding.admin.recordings.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-reportAdherence"]',
    route: '/alerts/scheduling',
    titleKey: 'onboarding.admin.reports.title',
    contentKey: 'onboarding.admin.reports.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-plan"]',
    route: '/alerts/scheduling',
    titleKey: 'onboarding.admin.plan.title',
    contentKey: 'onboarding.admin.plan.content',
    placement: 'right',
  },
  {
    target: 'body',
    route: '/alerts/scheduling',
    titleKey: 'onboarding.admin.finish.title',
    contentKey: 'onboarding.admin.finish.content',
    placement: 'center',
  },
];

// ── OPERATOR tour: only what OPERATOR has permission to see ──────
// OPERATOR access (per navigation.ts roles):
//   dashboard, alertMonitor, callRecordings, alertOccurrences,
//   timeEntries, reportAttendance, reportSos.
// Nunca incluir scheduling / management / company / plan aqui.
export const OPERATOR_TOUR_STEPS: TourStepI18n[] = [
  {
    target: 'body',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.welcome.title',
    contentKey: 'onboarding.operator.welcome.content',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="monitor-kpis"]',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.kpis.title',
    contentKey: 'onboarding.operator.kpis.content',
    placement: 'bottom',
    spotlightPadding: 12,
  },
  {
    target: '[data-tour="monitor-events"]',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.eventCard.title',
    contentKey: 'onboarding.operator.eventCard.content',
    placement: 'top',
    spotlightPadding: 8,
  },
  {
    target: 'body',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.sosGlobal.title',
    contentKey: 'onboarding.operator.sosGlobal.content',
    placement: 'center',
  },
  {
    target: 'body',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.attendanceOwner.title',
    contentKey: 'onboarding.operator.attendanceOwner.content',
    placement: 'center',
  },
  {
    target: 'body',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.callActions.title',
    contentKey: 'onboarding.operator.callActions.content',
    placement: 'center',
  },
  {
    target: 'body',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.recording.title',
    contentKey: 'onboarding.operator.recording.content',
    placement: 'center',
  },
  {
    target: '[data-tour="sidebar-callRecordings"]',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.recordingsHistory.title',
    contentKey: 'onboarding.operator.recordingsHistory.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-alertOccurrences"]',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.occurrences.title',
    contentKey: 'onboarding.operator.occurrences.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-timeEntries"]',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.timeEntries.title',
    contentKey: 'onboarding.operator.timeEntries.content',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-reportSos"]',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.reports.title',
    contentKey: 'onboarding.operator.reports.content',
    placement: 'right',
  },
  {
    target: 'body',
    route: '/alerts/monitor',
    titleKey: 'onboarding.operator.finish.title',
    contentKey: 'onboarding.operator.finish.content',
    placement: 'center',
  },
];

/**
 * Decide which tour to run for a given user role. Returns `null` when
 * the role shouldn't see any auto tour (MANAGER / AUDITOR / VIGILANT).
 * Those users can still replay either tour manually from the header
 * menu, but the menu itself hides the replay item when this is null.
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
