import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type { ApiLoginResponse, ApiSingleResponse, LoginRequest } from '@/types/api';

export interface GeneratePasswordCodeResult {
  systemUser: string;
}

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

  /**
   * Step 1 of recovery flow - generates an email code and returns the
   * opaque `systemUser` identifier that must be sent back on step 2.
   * Mirrors legacy `Endpoints.systemUsers.gencode` from shieldgo-admin-web.
   */
  async generatePasswordCode(
    email: string,
  ): Promise<ApiSingleResponse<GeneratePasswordCodeResult>> {
    const { data } = await apiClient.post<ApiSingleResponse<GeneratePasswordCodeResult>>(
      endpoints.generatePasswordCode,
      { email },
    );
    return data;
  },

  async checkPasswordCode(params: { email: string; code: string }) {
    const { data } = await apiClient.post(endpoints.checkPasswordCode, params);
    return data;
  },

  /**
   * Step 2 of recovery flow - validates the code and sets the new password.
   * Legacy payload is `{ code, systemUser, password }` (NOT the email).
   */
  async resetPassword(params: {
    code: string;
    systemUser: string;
    password: string;
  }) {
    const { data } = await apiClient.post(endpoints.resetPassword, params);
    return data;
  },
};
