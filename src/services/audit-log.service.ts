import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';

/**
 * Canonical enum mirrored from the ms-company controller. Keep in
 * sync with ctr-audit-log.js ACTIONS.
 */
export type AuditAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ARCHIVED'
  | 'COLLABORATOR_CREATED'
  | 'COLLABORATOR_UPDATED'
  | 'COLLABORATOR_ARCHIVED'
  | 'CLIENT_CREATED'
  | 'CLIENT_UPDATED'
  | 'CLIENT_ARCHIVED'
  | 'SITE_CREATED'
  | 'SITE_UPDATED'
  | 'SITE_ARCHIVED'
  | 'EQUIPMENT_CREATED'
  | 'EQUIPMENT_UPDATED'
  | 'EQUIPMENT_ARCHIVED'
  | 'MODULES_CHANGED'
  | 'ATTENDANCE_OPENED'
  | 'ATTENDANCE_CLOSED'
  | 'RECORDING_PLAYED'
  | 'COMPANY_UPDATED';

export type AuditDomain =
  | 'USER'
  | 'COLLABORATOR'
  | 'CLIENT'
  | 'SITE'
  | 'EQUIPMENT'
  | 'MODULES'
  | 'ATTENDANCE'
  | 'RECORDING'
  | 'COMPANY';

export interface AuditLogEntry {
  _id: string;
  accountId: string;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
  };
  action: AuditAction;
  domain: AuditDomain;
  resourceId: string | null;
  resourceLabel: string | null;
  payload: Record<string, unknown> | null;
  clientId: string | null;
  siteId: string | null;
  at: string;
}

export interface AuditLogFilterParams {
  skip?: number;
  limit?: number;
  action?: AuditAction;
  domain?: AuditDomain;
  actorId?: string;
  clientId?: string;
  siteId?: string;
  startDate?: string;
  endDate?: string;
  /** SUPER_ADMIN_MASTER only; ignored for other roles. */
  accountId?: string;
}

export interface AuditCapturePayload {
  action: AuditAction;
  domain: AuditDomain;
  resourceId?: string;
  resourceLabel?: string;
  payload?: Record<string, unknown>;
  clientId?: string;
  siteId?: string;
  /** SAM-only override to point the entry at a specific tenant. */
  accountId?: string;
}

export interface AuditLogPage {
  results: AuditLogEntry[];
  totalCount: number;
}

export const auditLogService = {
  /**
   * Fire-and-forget capture. Resolves to `false` on failure so callers
   * can log + continue without aborting their main action. Never
   * throws.
   */
  async capture(input: AuditCapturePayload): Promise<boolean> {
    try {
      await apiClient.post(endpoints.auditLogCapture, input);
      return true;
    } catch {
      return false;
    }
  },

  async filter(params: AuditLogFilterParams): Promise<AuditLogPage> {
    const { data } = await apiClient.post<{
      results?: AuditLogEntry[];
      totalCount?: number;
      result?: { totalCount?: number };
    }>(endpoints.auditLogFilter, params);
    return {
      results: data?.results ?? [],
      totalCount: data?.totalCount ?? data?.result?.totalCount ?? 0,
    };
  },
};
