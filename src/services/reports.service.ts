import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type {
  AdherenceReport,
  AttendanceReport,
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
      params,
    );
    return unwrap<AdherenceReport>(data);
  },

  async attendance(params: ReportFilterParams): Promise<AttendanceReport> {
    const { data } = await apiClient.post<AttendanceReport>(
      endpoints.reportsAttendance,
      params,
    );
    return unwrap<AttendanceReport>(data);
  },

  async sos(params: ReportFilterParams): Promise<SosReport> {
    const { data } = await apiClient.post<SosReport>(
      endpoints.reportsSos,
      params,
    );
    return unwrap<SosReport>(data);
  },

  async sla(params: ReportFilterParams & { slaThresholdSec?: number }): Promise<SlaReport> {
    const { data } = await apiClient.post<SlaReport>(
      endpoints.reportsSla,
      params,
    );
    return unwrap<SlaReport>(data);
  },
};
