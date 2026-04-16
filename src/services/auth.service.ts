import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type { ApiLoginResponse, LoginRequest } from '@/types/api';

export const authService = {
  async login(credentials: LoginRequest): Promise<ApiLoginResponse> {
    const { data } = await apiClient.post<ApiLoginResponse>(endpoints.login, credentials);
    return data;
  },

  async getMe() {
    const { data } = await apiClient.get(endpoints.me);
    return data;
  },

  async getCompanyUserMe() {
    const { data } = await apiClient.get(endpoints.companyUserMe);
    return data;
  },

  async changeLanguage(language: string) {
    const { data } = await apiClient.post(endpoints.changeLanguage, { language });
    return data;
  },

  async changePassword(params: { currentPassword: string; newPassword: string }) {
    const { data } = await apiClient.post(endpoints.changePasswordOnline, params);
    return data;
  },

  async generatePasswordCode(email: string) {
    const { data } = await apiClient.post(endpoints.generatePasswordCode, { email });
    return data;
  },

  async checkPasswordCode(params: { email: string; code: string }) {
    const { data } = await apiClient.post(endpoints.checkPasswordCode, params);
    return data;
  },

  async resetPassword(params: { email: string; code: string; password: string }) {
    const { data } = await apiClient.post(endpoints.resetPassword, params);
    return data;
  },
};
