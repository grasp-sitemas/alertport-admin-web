/**
 * Shapes returned by the AlertPort reports endpoints under
 * `/api/reports/alertport/*`. Mirrors the backend aggregation results
 * from ms-report/services/alertport-reports-service.js.
 *
 * Each report returns a `summary` (KPI block the UI pins to the top),
 * `results` (paginated detail rows for the table), and `totalCount`
 * for pagination. The `generatedAt`/`durationMs` fields are
 * diagnostic - surfaced in the footer so operators know they're
 * looking at fresh data.
 */

import type { Company, User } from '@/types/api';

export interface ReportFilterParams {
  account?: string;
  client?: string;
  site?: string;
  /** ISO date - required. */
  startDate: string;
  /** ISO date - required. Must be within 30 days of startDate. */
  endDate: string;
  limit?: number;
  skip?: number;
}

export interface ReportEnvelope<TSummary, TRow> {
  summary: TSummary;
  results: TRow[];
  totalCount: number;
  generatedAt: string;
  durationMs: number;
}

// ── 1. Aderência de Ronda ──────────────────────────────────────
export interface AdherenceSummary {
  total: number;
  attended: number;
  missed: number;
  expired: number;
  pending: number;
  adherenceRate: number;
  avgResponseTimeSec: number;
}

export interface AdherenceRow {
  _id: string;
  status: 'PENDING' | 'RESPONDED' | 'MISSED' | 'EXPIRED';
  scheduledAt: string;
  triggeredAt?: string | null;
  respondedAt?: string | null;
  expireAt?: string | null;
  account?: Pick<Company, '_id' | 'name'>;
  site?: Pick<Company, '_id' | 'name'>;
  client?: Pick<Company, '_id' | 'name'>;
  responseTimeSec?: number | null;
}

// ── 2. Controle de Presença ────────────────────────────────────
export interface AttendanceSummary {
  total: number;
  clockIns: number;
  clockOuts: number;
  breakStarts: number;
  breakEnds: number;
  uniqueUsers: number;
}

export interface AttendanceRow {
  _id: string;
  eventType: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  method?: 'PHOTO' | 'PIN';
  createdAt: string;
  user?: Pick<User, '_id' | 'firstName' | 'lastName'>;
  account?: Pick<Company, '_id' | 'name'>;
  client?: Pick<Company, '_id' | 'name'>;
  site?: Pick<Company, '_id' | 'name'>;
}

// ── 3. Alertas de SOS ──────────────────────────────────────────
export interface SosSummary {
  total: number;
  attended: number;
  unattended: number;
  closed: number;
  attendedRate: number;
  avgResponseTimeSec: number;
}

export interface SosRow {
  _id: string;
  type: 'SOS_ALERT';
  date: string;
  account?: Pick<Company, '_id' | 'name'>;
  site?: Pick<Company, '_id' | 'name'>;
  client?: Pick<Company, '_id' | 'name'>;
  vigilant?: Pick<User, '_id' | 'firstName' | 'lastName'>;
  operator?: Pick<User, '_id' | 'firstName' | 'lastName'>;
  attendance?: {
    isAttendance?: boolean;
    status?: 'IN_PROGRESS' | 'CLOSED';
    openedDate?: string | null;
    closedDate?: string | null;
  };
  responseTimeSec?: number | null;
  resolutionTimeSec?: number | null;
}

// ── 4. SLA de Atendimento ──────────────────────────────────────
export interface SlaSummary {
  total: number;
  avgResponseTimeSec: number;
  p50ResponseTimeSec: number;
  p95ResponseTimeSec: number;
  avgResolutionTimeSec: number;
  p50ResolutionTimeSec: number;
  p95ResolutionTimeSec: number;
  withinSlaCount: number;
  slaThresholdSec: number;
  slaCompliance: number;
}

export interface SlaOperatorBreakdown {
  _id: string;
  count: number;
  avgResponseTimeSec: number;
  operator?: Pick<User, 'firstName' | 'lastName'>;
}

export interface SlaRow {
  _id: string;
  type: 'SOS_ALERT';
  date: string;
  account?: Pick<Company, '_id' | 'name'>;
  client?: Pick<Company, '_id' | 'name'>;
  site?: Pick<Company, '_id' | 'name'>;
  operator?: Pick<User, '_id' | 'firstName' | 'lastName'>;
  attendance?: {
    status?: 'IN_PROGRESS' | 'CLOSED';
    openedDate?: string | null;
    closedDate?: string | null;
  };
  responseTimeSec?: number | null;
  resolutionTimeSec?: number | null;
}

// ── 5. AlertPort device-event reports (power, battery, on/off, ──
//        violation, remote-restart). All five share a single envelope
//        shape because they're filtered slices of the same
//        device-event collection (only the eventTypes differ).
export interface DeviceEventSummary {
  total: number;
  /** Per-eventType counts keyed by the backend's category label
   * (e.g. POWER_LOSS / POWER_RESTORED / BATTERY_LOW / ...). */
  byType: Record<string, number>;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface DeviceEventRow {
  _id: string;
  eventDate: string;
  eventType: number;
  eventCategory: string;
  /** Reported by the gateway: ALERTPORT | JWM_L5 | OTHER. */
  deviceType: string;
  readerCode: string;
  tagId?: string;
  account?: Pick<Company, '_id' | 'name'>;
  client?: Pick<Company, '_id' | 'name'>;
  site?: Pick<Company, '_id' | 'name'>;
  equipment?: { _id: string; uniqueId?: string };
}

export type DeviceEventReport = ReportEnvelope<DeviceEventSummary, DeviceEventRow>;

export type AdherenceReport = ReportEnvelope<AdherenceSummary, AdherenceRow>;
export type AttendanceReport = ReportEnvelope<AttendanceSummary, AttendanceRow>;
export type SosReport = ReportEnvelope<SosSummary, SosRow>;
export interface SlaReport extends ReportEnvelope<SlaSummary, SlaRow> {
  operators?: SlaOperatorBreakdown[];
}

export type ReportKind =
  | 'adherence'
  | 'attendance'
  | 'sos'
  | 'sla'
  | 'power-events'
  | 'battery-low'
  | 'equipment-status'
  | 'violation'
  | 'remote-restart';
