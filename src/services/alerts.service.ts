import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import { normalizePage, type NormalizedPage } from '@/lib/pagination';
import type {
  AlertOccurrence,
  AlertSchedule,
  AlertScheduleFormData,
  ApiPaginatedResponse,
  ApiSingleResponse,
  AttendanceRecord,
  AttendanceType,
  EventAttendance,
  FilterParams,
  PatrolAction,
  TimeEntry,
} from '@/types/api';

export const alertsService = {
  // ─── Alert Schedules ──────────────────────────────────────

  async filterSchedules(params: FilterParams): Promise<NormalizedPage<AlertSchedule>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<AlertSchedule>>(
      endpoints.appointmentsFilterV2,
      { ...params, category: 'ALERT_CHECK' },
    );
    return normalizePage(data);
  },

  /**
   * Fetches the FULL schedule doc by _id. The calendar endpoint
   * (appointments/filter/v2) returns an appointment-shape row that may
   * omit or differently-format series-wide fields (name, endDate,
   * frequency, weeklyDays, alertConfig). We need the raw schedule to
   * rehydrate the edit form cleanly.
   */
  async getScheduleById(id: string): Promise<AlertSchedule | null> {
    if (!id) return null;
    const { data } = await apiClient.get<
      | ApiSingleResponse<AlertSchedule>
      | { status: number; result?: AlertSchedule; results?: AlertSchedule[] }
    >(endpoints.scheduleById(id));
    // Legacy endpoint sometimes returns `result`, sometimes `results[0]`,
    // sometimes a top-level doc — normalize both shapes.
    if (data && typeof data === 'object') {
      if ('result' in data && data.result) return data.result as AlertSchedule;
      if ('results' in data && Array.isArray(data.results) && data.results[0]) {
        return data.results[0] as AlertSchedule;
      }
    }
    return null;
  },

  async createSchedule(
    scheduleData: AlertScheduleFormData,
  ): Promise<ApiSingleResponse<AlertSchedule>> {
    const { data } = await apiClient.post<ApiSingleResponse<AlertSchedule>>(
      endpoints.alertportScheduleCreate,
      scheduleData,
    );
    return data;
  },

  async updateSchedule(
    scheduleData: AlertScheduleFormData,
  ): Promise<ApiSingleResponse<AlertSchedule>> {
    const { data } = await apiClient.post<ApiSingleResponse<AlertSchedule>>(
      endpoints.alertportScheduleUpdate,
      scheduleData,
    );
    return data;
  },

  /**
   * Update the entire series from a start date forward. Wipes appointments
   * and alert-occurrences >= beginDate for the schedule and regenerates
   * them with the new config. Mirrors the "Edit Series" modal in
   * shieldgo-admin-web's AlertOccurrence calendar.
   *
   * Required payload fields: `schedule` (the schedule _id — NOT `_id`),
   * beginDate (first day of the new series), and every other field the
   * backend needs to rebuild the schedule. The controller
   * ctr.updateSchedule() in ms-schedule reads `schedule` as the target id.
   */
  async updateScheduleSeries(
    payload: AlertScheduleFormData & { schedule: string; alertOccurrence?: boolean },
  ): Promise<ApiSingleResponse<AlertSchedule>> {
    const { data } = await apiClient.post<ApiSingleResponse<AlertSchedule>>(
      endpoints.scheduleSeriesUpdate,
      { alertOccurrence: true, ...payload },
    );
    return data;
  },

  /**
   * Update a single appointment (single-day occurrence) of a recurring
   * schedule. Rebuilds just that one appointment + its alert-occurrences
   * without touching the rest of the series. Used for "this day only"
   * edits on the calendar.
   *
   * Payload carries both the schedule id and the target appointment id.
   */
  async updateAppointmentOccurrence(payload: {
    schedule: string;
    appointment: string;
    name?: string;
    account?: string;
    client?: string;
    site?: string;
    equipment?: string;
    category: 'ALERT_CHECK';
    beginDate: string;
    endDate: string;
    beginHour: string;
    endHour: string;
    alertConfig?: AlertScheduleFormData['alertConfig'];
    alertOccurrence?: boolean;
  }): Promise<ApiSingleResponse<unknown>> {
    const { data } = await apiClient.post<ApiSingleResponse<unknown>>(
      endpoints.appointmentUpdateOccurrence,
      { alertOccurrence: true, ...payload },
    );
    return data;
  },

  /**
   * Cancel the entire series starting from a given date. Archives the
   * schedule and deletes future appointments + alert-occurrences.
   */
  async cancelAppointmentSeries(payload: {
    schedule: string;
    startDate: string;
    alertOccurrence?: boolean;
  }): Promise<ApiSingleResponse<unknown>> {
    const { data } = await apiClient.post<ApiSingleResponse<unknown>>(
      endpoints.appointmentCancelSeries,
      { alertOccurrence: true, ...payload },
    );
    return data;
  },

  /**
   * Cancel a single appointment (one day). Keeps the series running on
   * other days. Deletes the appointment + its alert-occurrences +
   * firestore events.
   */
  async cancelAppointmentOccurrence(payload: {
    appointment: string;
    schedule?: string;
    alertOccurrence?: boolean;
  }): Promise<ApiSingleResponse<unknown>> {
    const { data } = await apiClient.post<ApiSingleResponse<unknown>>(
      endpoints.appointmentCancelOccurrence,
      { alertOccurrence: true, ...payload },
    );
    return data;
  },

  // ─── Alert Occurrences ────────────────────────────────────

  async filterOccurrences(params: FilterParams): Promise<NormalizedPage<AlertOccurrence>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<AlertOccurrence>>(
      endpoints.occurrencesFilter,
      params,
    );
    return normalizePage(data);
  },

  // ─── Time Entries ─────────────────────────────────────────

  async filterTimeEntries(params: FilterParams): Promise<NormalizedPage<TimeEntry>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<TimeEntry>>(
      endpoints.timeEntriesFilter,
      params,
    );
    return normalizePage(data);
  },

  // ─── Patrol Actions (Events) ──────────────────────────────

  async filterPatrolActions(params: FilterParams): Promise<NormalizedPage<PatrolAction>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<PatrolAction>>(
      endpoints.patrolActionsFilter,
      { ...params, sources: ['ALERTPORT'] },
    );
    return normalizePage(data);
  },

  // ─── Patrol-Action Attendance flag (open / close) ─────────
  //
  // Mirrors shieldgo-admin-web: `POST /api/users/patrol/actions/attendance/v1/`
  // with `{ patrolActionId, attendance: { isAttendance, openedDate, closedDate,
  // operator, status }, siteGroup }`.

  async openAttendance(params: {
    patrolActionId: string;
    operator: string;
    siteGroup?: string;
  }): Promise<ApiSingleResponse<{ attendance: EventAttendance }>> {
    const { patrolActionId, operator, siteGroup } = params;
    const attendance: EventAttendance = {
      isAttendance: true,
      openedDate: new Date().toISOString(),
      operator,
      status: 'IN_PROGRESS',
    };
    const { data } = await apiClient.post<
      ApiSingleResponse<{ attendance: EventAttendance }>
    >(endpoints.attendanceEvent, { patrolActionId, attendance, siteGroup });
    return data;
  },

  async closeAttendance(params: {
    patrolActionId: string;
    operator: string;
    openedDate?: string;
    siteGroup?: string;
  }): Promise<ApiSingleResponse<{ attendance: EventAttendance }>> {
    const { patrolActionId, operator, openedDate, siteGroup } = params;
    const attendance: EventAttendance = {
      isAttendance: true,
      openedDate,
      closedDate: new Date().toISOString(),
      operator,
      status: 'CLOSED',
    };
    const { data } = await apiClient.post<
      ApiSingleResponse<{ attendance: EventAttendance }>
    >(endpoints.attendanceEvent, { patrolActionId, attendance, siteGroup });
    return data;
  },

  /**
   * @deprecated Use `openAttendance` / `closeAttendance` / `createAttendanceRecord`.
   * Kept as a passthrough to avoid breaking any external caller that still
   * relied on the old shape.
   */
  async createAttendance(
    patrolActionId: string,
    attendance: Partial<EventAttendance>,
    siteGroup?: string,
  ): Promise<ApiSingleResponse<{ attendance: EventAttendance }>> {
    const { data } = await apiClient.post<
      ApiSingleResponse<{ attendance: EventAttendance }>
    >(endpoints.attendanceEvent, { patrolActionId, attendance, siteGroup });
    return data;
  },

  // ─── Individual Attendance Records ────────────────────────
  //
  // `POST /api/users/attendances/v1/` creates one record (type + notes) for a
  // patrol action. Multiple records per patrol-action are allowed.
  // `POST /api/users/attendances/filter/v1/` lists them.

  async createAttendanceRecord(
    payload: Omit<AttendanceRecord, '_id' | 'createDate' | 'status'> & {
      createDate?: string;
      status?: AttendanceRecord['status'];
    },
  ): Promise<ApiSingleResponse<AttendanceRecord>> {
    const body = {
      createDate: new Date().toISOString(),
      status: 'ACTIVE' as const,
      ...payload,
    };
    const { data } = await apiClient.post<ApiSingleResponse<AttendanceRecord>>(
      endpoints.attendances,
      body,
    );
    return data;
  },

  async filterAttendances(params: FilterParams): Promise<NormalizedPage<AttendanceRecord>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<AttendanceRecord>>(
      endpoints.attendancesFilter,
      params,
    );
    return normalizePage(data);
  },

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Fetches the attendance type catalog. The legacy API returns
   * `{ status, results: [{_id, name}] }` — NOT `{ status, result }` — so we
   * normalize to a bare array and let callers consume it directly.
   * Matches shieldgo-admin-web's Services.getAttendancesOptionsTypes.
   */
  async getAttendanceTypes(): Promise<AttendanceType[]> {
    const { data } = await apiClient.get<{ status: number; results?: AttendanceType[] }>(
      endpoints.attendanceTypes,
    );
    return Array.isArray(data?.results) ? data.results : [];
  },

  // ─── Charts ───────────────────────────────────────────────

  async getEventsAnalysis(params: FilterParams) {
    const { data } = await apiClient.post(endpoints.chartsEventsAnalysis, params);
    return data;
  },

  async getEventsPerDay(params: FilterParams) {
    const { data } = await apiClient.post(endpoints.chartsEventsPerDay, params);
    return data;
  },

  async getEventsByType(params: FilterParams) {
    const { data } = await apiClient.post(endpoints.chartsEventsByType, params);
    return data;
  },
};
