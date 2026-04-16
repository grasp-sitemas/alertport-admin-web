import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type {
  ApiPaginatedResponse,
  ApiSingleResponse,
  FilterParams,
  User,
  UserFormData,
} from '@/types/api';

export const usersService = {
  async filter(params: FilterParams): Promise<ApiPaginatedResponse<User>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<User>>(
      endpoints.usersByType('COMPANY_USER'),
      params,
    );
    return data;
  },

  async getById(id: string): Promise<ApiSingleResponse<User>> {
    const { data } = await apiClient.get<ApiSingleResponse<User>>(endpoints.userById(id));
    return data;
  },

  async create(userData: UserFormData): Promise<ApiSingleResponse<User>> {
    const { data } = await apiClient.post<ApiSingleResponse<User>>(endpoints.users, userData);
    return data;
  },

  async update(id: string, userData: Partial<UserFormData>): Promise<ApiSingleResponse<User>> {
    const { data } = await apiClient.put<ApiSingleResponse<User>>(
      endpoints.userById(id),
      userData,
    );
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.post(endpoints.deleteUser, { _id: id });
  },

  async getFormData() {
    const { data } = await apiClient.get(endpoints.userFormData);
    return data;
  },

  async filterCollaborators(params: FilterParams): Promise<ApiPaginatedResponse<User>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<User>>(
      endpoints.usersByType('VIGILANT'),
      params,
    );
    return data;
  },
};
