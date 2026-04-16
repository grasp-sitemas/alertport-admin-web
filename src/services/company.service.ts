import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import { normalizePage, type NormalizedPage } from '@/lib/pagination';
import type {
  ApiPaginatedResponse,
  ApiSingleResponse,
  Company,
  CompanyFormData,
  FilterParams,
} from '@/types/api';

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

  async create(companyData: CompanyFormData): Promise<ApiSingleResponse<Company>> {
    const { data } = await apiClient.post<ApiSingleResponse<Company>>(
      endpoints.companies,
      companyData,
    );
    return data;
  },

  async update(
    id: string,
    companyData: Partial<CompanyFormData>,
  ): Promise<ApiSingleResponse<Company>> {
    const { data } = await apiClient.put<ApiSingleResponse<Company>>(
      endpoints.companyById(id),
      companyData,
    );
    return data;
  },

  async delete(id: string): Promise<void> {
    // Legacy uses DELETE /api/company/v1/{id} with body. Some envs also support /delete/v1
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
