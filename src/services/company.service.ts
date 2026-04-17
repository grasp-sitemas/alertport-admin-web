import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import { normalizePage, type NormalizedPage } from '@/lib/pagination';
import type {
  ApiPaginatedResponse,
  ApiSingleResponse,
  Company,
  CompanyFormData,
  FilterParams,
  User,
} from '@/types/api';

/**
 * Build the multipart payload the legacy `/api/company/formdata/v1/` endpoint
 * expects.
 *
 * IMPORTANT: do NOT append `file` when there is no file. The API Gateway uses
 * `multer.array('file', 100)` — if we append an empty Blob, multer treats it
 * as a valid upload, tries to persist it to `uploads/<generated-name>`, and
 * blows up with `ENOENT` on containers where that directory is ephemeral
 * (Heroku). Shieldgo-admin-web's CrtClient.vue relies on the implicit
 * "undefined file" → string coercion in the browser, which multer skips. We
 * match that behavior by omitting the field entirely unless a real File is
 * provided.
 */
function toFormData(payload: unknown, file?: File | null): FormData {
  const fd = new FormData();
  if (file) fd.append('file', file);
  fd.append('jsonData', JSON.stringify(payload));
  return fd;
}

export const companyService = {
  async filter(params: FilterParams): Promise<NormalizedPage<Company>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Company>>(
      endpoints.companyFilter,
      params,
    );
    return normalizePage(data);
  },

  async getById(id: string): Promise<ApiSingleResponse<Company>> {
    const { data } = await apiClient.get<ApiSingleResponse<Company>>(endpoints.companyById(id));
    return data;
  },

  /**
   * Loads the logged-in user's full profile. The response includes the
   * company / account / client / site populated objects, so the Register Data
   * page can pick the right one based on the user's role. Mirrors the legacy
   * `/api/users/system/companyuser/me/v1` flow.
   */
  async getMe(): Promise<ApiSingleResponse<User>> {
    const { data } = await apiClient.get<ApiSingleResponse<User>>(endpoints.companyUserMe);
    return data;
  },

  async create(
    companyData: CompanyFormData,
    file?: File | null,
  ): Promise<ApiSingleResponse<Company>> {
    // Legacy uses POST /api/company/formdata/v1/ with multipart FormData
    const fd = toFormData(companyData, file);
    const { data } = await apiClient.post<ApiSingleResponse<Company>>(
      endpoints.companyFormData,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async update(
    id: string,
    companyData: Partial<CompanyFormData>,
    file?: File | null,
  ): Promise<ApiSingleResponse<Company>> {
    // Legacy uses PUT /api/company/formdata/v1/{id} with multipart FormData
    const fd = toFormData(companyData, file);
    const { data } = await apiClient.put<ApiSingleResponse<Company>>(
      endpoints.companyFormDataById(id),
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async delete(id: string): Promise<void> {
    // Legacy uses DELETE /api/company/v1/{id} with body
    await apiClient.delete(endpoints.companyById(id), { data: { _id: id } });
  },

  async getFormData() {
    const { data } = await apiClient.get(endpoints.companyFormData);
    return data;
  },

  async getSettings() {
    const { data } = await apiClient.get(endpoints.companySettingsMe);
    return data;
  },

  async updateSettings(id: string, settings: Record<string, unknown>) {
    const { data } = await apiClient.put(endpoints.companySettingsById(id), settings);
    return data;
  },

  async filterSites(params: FilterParams): Promise<NormalizedPage<Company>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Company>>(endpoints.companyFilter, {
      ...params,
      type: 'SITE',
    });
    return normalizePage(data);
  },

  async filterClients(params: FilterParams): Promise<NormalizedPage<Company>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Company>>(endpoints.companyFilter, {
      ...params,
      type: 'CLIENT',
    });
    return normalizePage(data);
  },

  async filterAccounts(params: FilterParams): Promise<NormalizedPage<Company>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Company>>(endpoints.companyFilter, {
      ...params,
      type: 'ACCOUNT',
    });
    return normalizePage(data);
  },
};
