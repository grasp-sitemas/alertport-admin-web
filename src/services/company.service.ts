import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import { normalizePage, type NormalizedPage } from '@/lib/pagination';
import { toMultipartFormData } from '@/lib/multipart-form-data';
import type {
  ApiPaginatedResponse,
  ApiSingleResponse,
  Company,
  CompanyFormData,
  FilterParams,
  User,
} from '@/types/api';

// Multipart helper lives in @/lib/multipart-form-data so both services share
// the "never append an empty Blob" rule that avoids the multer ENOENT crash.
const toFormData = toMultipartFormData;

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
    // Don't set Content-Type — let Axios/browser set it with proper boundary
    const fd = toFormData(companyData, file);
    const { data } = await apiClient.post<ApiSingleResponse<Company>>(
      endpoints.companyFormData,
      fd,
    );
    return data;
  },

  async update(
    id: string,
    companyData: Partial<CompanyFormData>,
    file?: File | null,
  ): Promise<ApiSingleResponse<Company>> {
    // Legacy uses PUT /api/company/formdata/v1/{id} with multipart FormData
    // Don't set Content-Type — let Axios/browser set it with proper boundary
    const fd = toFormData(companyData, file);
    const { data } = await apiClient.put<ApiSingleResponse<Company>>(
      endpoints.companyFormDataById(id),
      fd,
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
