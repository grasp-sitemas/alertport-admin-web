// All endpoints mirror the existing shieldgo backend exactly.
// Do NOT change paths, params, or contracts.

import { env } from './env';

function url(path: string): string {
  return `${env.apiUrl}${path}`;
}

export const endpoints = {
  // ─── Auth ────────────────────────────────────────────────
  login: url('/api/users/system/login/v1/'),
  signup: url('/api/users/system/signup/v1'),
  activationConfirm: url('/api/users/system/activation/confirm/v1'),
  activationResend: url('/api/users/system/activation/resend/v1'),
  // Login throttle unlock (per-account brute-force defense).
  // Request: always returns 200 generic (anti user-enumeration).
  // Confirm: validates the single-use unlock token from the email.
  loginUnlockRequest: url('/api/users/system/login/unlock/v1'),
  loginUnlockConfirm: url('/api/users/system/login/unlock/confirm/v1'),
  me: url('/api/users/me/v1/'),
  companyUserMe: url('/api/users/system/companyuser/me/v1'),
  changeLanguage: url('/api/users/system/change/language/v1/'),
  changePasswordOnline: url('/api/users/system/password/change/online/v1/'),
  generatePasswordCode: url('/api/users/system/password/gencode/v1/'),
  checkPasswordCode: url('/api/users/system/password/checkcode/v1/'),
  resetPassword: url('/api/users/system/password/change/v1/'),

  // ─── Users ───────────────────────────────────────────────
  users: url('/api/users/v1/'),
  userById: (id: string) => url(`/api/users/v1/${id}`),
  userByEmail: (email: string) => url(`/api/users/v1/${encodeURIComponent(email)}`),
  userFormData: url('/api/users/formdata/v1/'),
  userFormDataById: (id: string) => url(`/api/users/formdata/v1/${id}`),
  usersByType: (type: string) => url(`/api/users/bytype/v1/${type}`),
  deleteUser: url('/api/users/delete/v1/'),

  // ─── System Users (customer users a.k.a. collaborators / vigilants) ─
  // Mirrors shieldgo Endpoints.vue: systemUsers.customerUser.search
  customerUserSearch: url('/api/users/system/search/customeruser/v1/'),
  // Admin company-user search (the one ListUser.vue uses)
  companyUserSearch: url('/api/users/system/search/companyuser/v1/'),
  checkEmailExists: (email: string) =>
    url(`/api/users/check/email/v1/${encodeURIComponent(email)}`),
  checkUsernameExists: (username: string) =>
    url(`/api/users/check/username/v1/${encodeURIComponent(username)}`),

  // ─── Companies ───────────────────────────────────────────
  companyFilter: url('/api/company/filter/v1/'),
  companyFilterV2: url('/api/company/filter/v2/'),
  companies: url('/api/company/v1/'),
  companyById: (id: string) => url(`/api/company/v1/${id}`),
  deleteCompany: url('/api/company/delete/v1/'),
  companyFormData: url('/api/company/formdata/v1/'),
  companyFormDataById: (id: string) => url(`/api/company/formdata/v1/${id}`),

  // ─── Company Settings ────────────────────────────────────
  companySettingsMe: url('/api/company/settings/me/v1/'),
  companySettingsFilter: url('/api/company/settings/filter/v1/'),
  companySettingsById: (id: string) => url(`/api/company/settings/v1/${id}`),
  companySettings: url('/api/company/settings/v1/'),

  // ─── Sites ───────────────────────────────────────────────
  sitesFilter: url('/api/company/sites/filter/v1/'),
  siteById: (id: string) => url(`/api/company/sites/v1/${id}`),
  sites: url('/api/company/sites/v1/'),
  deleteSite: url('/api/company/sites/delete/v1/'),

  // ─── Equipment ───────────────────────────────────────────
  equipmentsFilter: url('/api/company/equipments/filter/v1/'),
  equipmentById: (id: string) => url(`/api/company/equipments/v1/${id}`),
  equipments: url('/api/company/equipments/v1/'),
  deleteEquipment: url('/api/company/equipments/delete/v1/'),

  // ─── Schedules ───────────────────────────────────────────
  schedulesFilter: url('/api/schedules/filter/v1/'),
  scheduleById: (id: string) => url(`/api/schedules/v1/${id}`),
  schedules: url('/api/schedules/v1/'),
  scheduleUpdate: (id: string) => url(`/api/schedules/update/v1/${id}`),
  deleteSchedule: url('/api/schedules/delete/v1/'),

  // AlertPort-specific schedule endpoints
  alertportScheduleCreate: url('/api/schedules/alertport/v1/'),
  alertportScheduleUpdate: url('/api/schedules/alertport/update/v1/'),
  // Series-wide update (legacy "update the whole schedule from startDate
  // forward"). Mirror of POST /api/schedules/update/v1/ used by the
  // shieldgo-admin-web AlertOccurrence modal.
  scheduleSeriesUpdate: url('/api/schedules/update/v1/'),

  // ─── Alert Occurrences ───────────────────────────────────
  occurrencesFilter: url('/api/schedules/occurences/filter/v1/'),

  // ─── Time Entries ────────────────────────────────────────
  timeEntriesFilter: url('/api/schedules/timeentries/filter/v1/'),

  // ─── Appointments ────────────────────────────────────────
  appointmentsFilter: url('/api/schedules/appointments/filter/v1/'),
  appointmentsFilterV2: url('/api/schedules/appointments/filter/v2/'),
  appointmentById: (id: string) => url(`/api/schedules/appointments/v1/${id}`),
  appointments: url('/api/schedules/appointments/v1/'),
  appointmentUpdate: (id: string) => url(`/api/schedules/appointments/update/v1/${id}`),
  deleteAppointment: url('/api/schedules/appointments/delete/v1/'),
  // Single-occurrence update (legacy ShieldGo SECURITY_PATROL appointment).
  // Kept for backwards compat; AlertPort uses appointmentAlertportUpdateOccurrence.
  appointmentUpdateOccurrence: url('/api/schedules/appointments/update/occurrence/v1/'),
  // AlertPort single-occurrence update: regenerates the alert-occurrences
  // for one workday + syncs Firestore. See ms-schedule
  // ctr-appointment.updateAlertOccurrenceAppointment.
  appointmentAlertportUpdateOccurrence: url(
    '/api/schedules/appointments/alertport/update/occurrence/v1/',
  ),
  // Cancel the series from a startDate forward (archives the schedule and
  // deletes all appointments/alert-occurrences from that date on).
  appointmentCancelSeries: url('/api/schedules/appointments/cancel/series/v1/'),
  // Cancel a single occurrence (deletes just that appointment + related
  // alert-occurrences + firestore events).
  appointmentCancelOccurrence: url('/api/schedules/appointments/cancel/occurrence/v1/'),

  // ─── Events / Patrol Actions ─────────────────────────────
  eventsFilter: url('/api/schedules/events/filter/v1/'),
  eventById: (id: string) => url(`/api/schedules/events/v1/${id}`),
  events: url('/api/schedules/events/v1/'),
  patrolActionsFilter: url('/api/users/patrol/actions/filter/v1/'),
  // AlertPort /monitor — caminho dedicado de alta volumetria.
  // Mesmo body do `patrolActionsFilter`. Backend força source='ALERTPORT'.
  patrolActionsFilterAlertportMonitor: url(
    '/api/users/patrol/actions/filter/alertport/monitor/v1/',
  ),
  attendanceEvent: url('/api/users/patrol/actions/attendance/v1/'),

  // ─── Attendances ─────────────────────────────────────────
  attendancesFilter: url('/api/users/attendances/filter/v1/'),
  attendanceById: (id: string) => url(`/api/users/attendances/v1/${id}`),
  attendances: url('/api/users/attendances/v1/'),

  // ─── Charts / Analytics ──────────────────────────────────
  chartsEventsAnalysis: url('/api/reports/charts/analisys/events/v1/'),
  chartsEventsPerDay: url('/api/reports/charts/analisys/events/perday/v1/'),
  chartsEventsByType: url('/api/reports/charts/events/bytype/v1/'),
  chartsEventsPerformance: url('/api/reports/charts/events/performance/v1/'),

  // ─── Logs ────────────────────────────────────────────────
  logsFilter: url('/api/logs/filter/v1/'),
  integrationLogsFilter: url('/api/logs/integrations/filter/v1/'),

  // ─── Helpers ─────────────────────────────────────────────
  attendanceTypes: url('/api/helpers/data/events/attendances/types/v1/'),
  monitorEventTypes: url('/api/helpers/data/monitor/events/types/v1/'),
  equipmentBrands: url('/api/helpers/data/equipments/brands/v1/'),
  equipmentTypes: url('/api/helpers/data/equipments/types/v1/'),
  timezones: url('/api/helpers/data/timezones/v1/'),

  // ─── Guard Groups ────────────────────────────────────────
  guardGroupsFilter: url('/api/users/guardgroups/filter/v1/'),
  guardGroupById: (id: string) => url(`/api/users/guardgroups/v1/${id}`),
  guardGroups: url('/api/users/guardgroups/v1/'),
  deleteGuardGroup: url('/api/users/guardgroups/delete/v1/'),

  // ─── Trial / Plan ────────────────────────────────────────
  trialContext: url('/api/company/trial/context/v1/'),
  trialStatus: url('/api/company/trial/status/v1/'),
  trialHistory: url('/api/company/trial/history/v1/'),
  trialStart: url('/api/company/trial/start/v1/'),
  trialExtend: url('/api/company/trial/extend/v1/'),
  trialExpire: url('/api/company/trial/expire/v1/'),
  trialConvert: url('/api/company/trial/convert/v1/'),
  planFeatures: url('/api/company/plan/features/v1/'),
  planLimits: url('/api/company/plan/limits/v1/'),

  // ─── AlertPort Reports ───────────────────────────────────
  reportsAdherence: url('/api/reports/alertport/adherence/v1/'),
  reportsAttendance: url('/api/reports/alertport/attendance/v1/'),
  reportsSos: url('/api/reports/alertport/sos/v1/'),
  reportsSla: url('/api/reports/alertport/sla/v1/'),
  reportsOperatorAttendance: url('/api/reports/alertport/operator-attendance/v1/'),
  reportsVigilantAlerts: url('/api/reports/alertport/vigilant-alerts/v1/'),
  // Device-event reports - share the same response envelope, differ
  // only in the eventTypes the backend filters by (see ms-report).
  reportsPowerEvents: url('/api/reports/alertport/power-events/v1/'),
  reportsBatteryLow: url('/api/reports/alertport/battery-low/v1/'),
  reportsEquipmentStatus: url('/api/reports/alertport/equipment-status/v1/'),
  reportsViolation: url('/api/reports/alertport/violation/v1/'),
  reportsRemoteRestart: url('/api/reports/alertport/remote-restart/v1/'),

  // ─── Onboarding ──────────────────────────────────────────
  onboardingStatus: url('/api/users/system/onboarding/status/v1/'),
  onboardingComplete: url('/api/users/system/onboarding/complete/v1/'),

  // ─── Account Modules (SUPER_ADMIN_MASTER plan management) ─
  accountModulesCatalog: url('/api/company/modules/catalog/v1/'),
  accountModulesByAccount: (accountId: string) =>
    url(`/api/company/modules/by-account/${accountId}/v1/`),

  // ─── Audit log (AlertPort-scoped activity trail) ──────────
  auditLogCapture: url('/api/company/audit-log/v1/'),
  auditLogFilter: url('/api/company/audit-log/filter/v1/'),

  // ─── LGPD data-subject (right of access + right of erasure) ─
  lgpdExport: url('/api/users/me/export/v1/'),
  lgpdDelete: url('/api/users/me/delete/v1/'),

  // ─── Addresses / Geolocation ─────────────────────────────
  addressGeolocation: url('/api/address/geo/v1/'),

  // ─── ViaCEP (external) ───────────────────────────────────
  viaCep: (cep: string) => `https://viacep.com.br/ws/${cep}/json`,
} as const;
