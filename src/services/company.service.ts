import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type {
  ApiPaginatedResponse,
  ApiSingleResponse,
  Company,
  CompanyFormData,
  FilterParams,
} from '@/types/api';

export const companyService = {
  async filter(params: FilterParams): Promise<ApiPaginatedResponse<Company>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Company>>(
      endpoints.companyFilter,
      params,
    );
    return data;
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

  async update(id: string, companyData: Partial<CompanyFormData>): Promise<ApiSingleResponse<Company>> {
    const { data } = await apiClient.put<ApiSingleResponse<Company>>(
      endpoints.companyById(id),
      companyData,
    );
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.post(endpoints.deleteCompany, { _id: id });
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

  async filterSites(params: FilterParams): Promise<ApiPaginatedResponse<Company>> {
    // Legacy uses /api/company/filter/v1/ with { type: 'SITE' }
    const { data } = await apiClient.post<ApiPaginatedResponse<Company>>(endpoints.companyFilter, {
      ...params,
      type: 'SITE',
    });
    return data;
  },

  async filterClients(params: FilterParams): Promise<ApiPaginatedResponse<Company>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Company>>(endpoints.companyFilter, {
      ...params,
      type: 'CLIENT',
    });
    return data;
  },

  async filterAccounts(params: FilterParams): Promise<ApiPaginatedResponse<Company>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Company>>(endpoints.companyFilter, {
      ...params,
      type: 'ACCOUNT',
    });
    return data;
  },
};

