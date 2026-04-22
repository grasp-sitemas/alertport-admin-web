import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';

/**
 * LGPD data-subject operations. Backend is ms-user; both endpoints
 * are scoped to the caller via JWT, so the UI never needs to pass
 * a user id.
 */

export interface LgpdExportSnapshot {
  exportedAt: string;
  subject: Record<string, unknown>;
  companyScope: Record<string, unknown> | null;
  role: Record<string, unknown> | null;
  address: Record<string, unknown> | null;
  raw: Record<string, unknown>;
}

export const lgpdService = {
  async exportMyData(): Promise<LgpdExportSnapshot> {
    const { data } = await apiClient.post<{ result: LgpdExportSnapshot }>(
      endpoints.lgpdExport,
      {},
    );
    if (!data?.result) throw new Error('lgpd.export.empty');
    return data.result;
  },

  /**
   * Self-delete. Throws on bad password (HTTP 403) so the caller can
   * surface a field-level error instead of a generic toast.
   */
  async deleteMyAccount(password: string): Promise<{ ok: boolean; anonymizedId: string }> {
    const { data } = await apiClient.post<{
      result: { ok: boolean; anonymizedId: string };
    }>(endpoints.lgpdDelete, { password });
    if (!data?.result?.ok) throw new Error('lgpd.delete.failed');
    return data.result;
  },
};
