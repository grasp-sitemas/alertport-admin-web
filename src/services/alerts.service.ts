import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import { normalizePage, type NormalizedPage } from '@/lib/pagination';
import type {
  AlertOccurrence,
  AlertSchedule,
  AlertScheduleFormData,
  ApiPaginatedResponse,
  ApiSingleResponse,
  EventAttendance,
  FilterParams,
  PatrolAction,
  TimeEntry,
  AttendanceType,
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

  // ─── Event Attendance ─────────────────────────────────────

  async createAttendance(
    patrolActionId: string,
    attendance: Partial<EventAttendance>,
    siteGroup?: string,
  ): Promise<ApiSingleResponse<EventAttendance>> {
    const { data } = await apiClient.post<ApiSingleResponse<EventAttendance>>(
      endpoints.attendanceEvent,
      { patrolActionId, attendance, siteGroup },
    );
    return data;
  },

  async filterAttendances(params: FilterParams): Promise<NormalizedPage<EventAttendance>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<EventAttendance>>(
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
