import { env } from '@/config/env';
import { apiClient } from '@/lib/api-client';
import { normalizePage } from '@/lib/pagination';
import type { Company } from '@/types/api';

export interface SiteGroup {
  _id?: string;
  name: string;
  account: string | Company;
  client: string | Company;
  sites: Array<string | Company>;
  status: 'ACTIVE' | 'ARCHIVED';
}
const base = `${env.apiUrl}/api/company/sitegroups/v1/`;
export const siteGroupsService = {
  async list(account: string) {
    if (!account) return [];
    const { data } = await apiClient.post(`${env.apiUrl}/api/company/sitegroups/filter/v1/`, {
      account,
      status: 'ACTIVE',
      skip: 1,
      limit: 500,
    });
    return normalizePage<SiteGroup>(data).results;
  },
  async save(group: SiteGroup) {
    const { _id, ...payload } = group;
    const { data } = _id
      ? await apiClient.put(`${base}${_id}`, payload)
      : await apiClient.post(base, payload);
    if (data.status !== 200) throw new Error('Unable to save site group');
    return data.result;
  },
  async archive(id: string) {
    const { data } = await apiClient.delete(`${base}${id}`, { data: { _id: id } });
    if (data.status !== 200) throw new Error('Unable to archive site group');
  },
};
