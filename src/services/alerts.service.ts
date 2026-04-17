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

  async getAttendanceTypes(): Promise<ApiSingleResponse<AttendanceType[]>> {
    const { data } = await apiClient.get<ApiSingleResponse<AttendanceType[]>>(
      endpoints.attendanceTypes,
    );
    return data;
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
