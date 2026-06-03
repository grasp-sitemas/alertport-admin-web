import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type {
  AdherenceReport,
  AttendanceReport,
  DeviceEventReport,
  ReportFilterParams,
  SlaReport,
  SosReport,
} from '@/types/reports';

/**
 * Client for the AlertPort reports endpoints exposed by ms-report
 * under `/api/reports/alertport/*`. All responses share the shape
 * `{ status, messageId, summary, results, totalCount, generatedAt,
 * durationMs }` - we unwrap the inner envelope so callers see a
 * plain ReportEnvelope<T, R>.
 *
 * The backend enforces a hard 30-day window on the date range;
 * callers should validate client-side too (see report-filter-panel)
 * so the UI never POSTs a guaranteed-failure request.
 */

/**
 * ms-report defaults `limit` to 50 when the field is absent (and clamps
 * it to [1, 10000] - see ms-report/helpers/alertport-report-helpers.js).
 * These report pages paginate the result set CLIENT-side
 * (see use-client-pagination), so a missing limit silently truncates BOTH
 * the table (pages beyond 50) AND the CSV/XLSX/PDF exports to the first 50
 * rows. The date range is already capped at 30 days, so pulling the full
 * set in one call is the intended design. We default to the backend max
 * but honor an explicit caller-provided limit.
 */
const REPORT_RESULT_LIMIT = 10000;

function withFullResultSet<T extends ReportFilterParams>(params: T): T {
  return params.limit ? params : { ...params, limit: REPORT_RESULT_LIMIT };
}

function unwrap<T>(data: unknown): T {
  // The backend wraps with `instantiateMessage` so `data` has
  // `{ status, messageId, summary, results, totalCount, generatedAt,
  // durationMs, operators? }`. The inner envelope is the whole
  // response minus the status/messageId/message fields - cheapest
  // to just return the full object and let callers read what they need.
  return data as T;
}

export const reportsService = {
  async adherence(params: ReportFilterParams): Promise<AdherenceReport> {
    const { data } = await apiClient.post<AdherenceReport>(
      endpoints.reportsAdherence,
      withFullResultSet(params),
    );
    return unwrap<AdherenceReport>(data);
  },

  async attendance(params: ReportFilterParams): Promise<AttendanceReport> {
    const { data } = await apiClient.post<AttendanceReport>(
      endpoints.reportsAttendance,
      withFullResultSet(params),
    );
    return unwrap<AttendanceReport>(data);
  },

  async sos(params: ReportFilterParams): Promise<SosReport> {
    const { data } = await apiClient.post<SosReport>(
      endpoints.reportsSos,
      withFullResultSet(params),
    );
    return unwrap<SosReport>(data);
  },

  async sla(params: ReportFilterParams & { slaThresholdSec?: number }): Promise<SlaReport> {
    const { data } = await apiClient.post<SlaReport>(
      endpoints.reportsSla,
      withFullResultSet(params),
    );
    return unwrap<SlaReport>(data);
  },

  async powerEvents(params: ReportFilterParams): Promise<DeviceEventReport> {
    const { data } = await apiClient.post<DeviceEventReport>(
      endpoints.reportsPowerEvents,
      withFullResultSet(params),
    );
    return unwrap<DeviceEventReport>(data);
  },

  async batteryLow(params: ReportFilterParams): Promise<DeviceEventReport> {
    const { data } = await apiClient.post<DeviceEventReport>(
      endpoints.reportsBatteryLow,
      withFullResultSet(params),
    );
    return unwrap<DeviceEventReport>(data);
  },

  async equipmentStatus(params: ReportFilterParams): Promise<DeviceEventReport> {
    const { data } = await apiClient.post<DeviceEventReport>(
      endpoints.reportsEquipmentStatus,
      withFullResultSet(params),
    );
    return unwrap<DeviceEventReport>(data);
  },

  async violation(params: ReportFilterParams): Promise<DeviceEventReport> {
    const { data } = await apiClient.post<DeviceEventReport>(
      endpoints.reportsViolation,
      withFullResultSet(params),
    );
    return unwrap<DeviceEventReport>(data);
  },

  async remoteRestart(params: ReportFilterParams): Promise<DeviceEventReport> {
    const { data } = await apiClient.post<DeviceEventReport>(
      endpoints.reportsRemoteRestart,
      withFullResultSet(params),
    );
    return unwrap<DeviceEventReport>(data);
  },
};
