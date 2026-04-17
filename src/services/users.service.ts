import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import { normalizePage, type NormalizedPage } from '@/lib/pagination';
import { toMultipartFormData } from '@/lib/multipart-form-data';
import type {
  ApiPaginatedResponse,
  ApiSingleResponse,
  FilterParams,
  User,
} from '@/types/api';

// ──────────────────────────────────────────────────────────────
// Admin users (type: USER-COMPANY) — /users page
// ──────────────────────────────────────────────────────────────

export interface AdminUserFormData {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  oldEmail?: string;
  username?: string;
  oldUsername?: string;
  primaryPhone?: string;
  photoURL?: string;
  password?: string;
  language?: string;
  account?: string;
  client?: string;
  site?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  companyUser: {
    subtype: string;
    status: 'ACTIVE' | 'ARCHIVED';
  };
  address?: Record<string, unknown>;
  type?: 'USER-COMPANY';
}

// ──────────────────────────────────────────────────────────────
// Customer users (type: USER-CUSTOMER) — /collaborators page
// ──────────────────────────────────────────────────────────────

export interface CustomerUserFilter extends FilterParams {
  subtype?: 'VIGILANT' | 'SUPERVISOR' | '';
  isSortByName?: boolean;
}

export interface CustomerUserFormData {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  oldEmail?: string;
  username: string;
  oldUsername?: string;
  primaryPhone?: string;
  photoURL?: string;
  password?: string;
  account: string;
  client: string;
  site: string;
  customerUser: {
    subtype: 'VIGILANT' | 'SUPERVISOR';
    status: 'ACTIVE' | 'ARCHIVED';
    employeeCode?: string;
  };
  address?: Record<string, unknown>;
  type: 'USER-CUSTOMER';
  status: 'ACTIVE' | 'ARCHIVED';
}

// Multipart helper lives in @/lib/multipart-form-data so both services share
// the "never append an empty Blob" rule that avoids the multer ENOENT crash.
const toFormData = toMultipartFormData;

export const usersService = {
  // ── Admin users (type USER-COMPANY) ──
  async filter(params: FilterParams): Promise<NormalizedPage<User>> {
    // Legacy uses POST /api/users/system/search/companyuser/v1/
    const { data } = await apiClient.post<ApiPaginatedResponse<User>>(
      endpoints.companyUserSearch,
      { isSortByName: true, ...params },
    );
    return normalizePage(data);
  },

  async getById(id: string): Promise<ApiSingleResponse<User>> {
    const { data } = await apiClient.get<ApiSingleResponse<User>>(endpoints.userById(id));
    return data;
  },

  async create(
    userData: AdminUserFormData,
    file?: File | null,
  ): Promise<ApiSingleResponse<User>> {
    const fd = toFormData(userData, file);
    const { data } = await apiClient.post<ApiSingleResponse<User>>(
      endpoints.userFormData,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async update(
    id: string,
    userData: Partial<AdminUserFormData>,
    file?: File | null,
  ): Promise<ApiSingleResponse<User>> {
    const fd = toFormData(userData, file);
    const { data } = await apiClient.put<ApiSingleResponse<User>>(
      endpoints.userFormDataById(id),
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async delete(idOrEmail: string, payload?: Record<string, unknown>): Promise<void> {
    // Legacy archives by DELETE /api/users/v1/{email} sending the full payload
    await apiClient.delete(endpoints.userByEmail(idOrEmail), { data: payload ?? {} });
  },

  async getFormData() {
    const { data } = await apiClient.get(endpoints.userFormData);
    return data;
  },

  // ── Customer users (collaborators / vigilants / supervisors) ──
  async filterCollaborators(params: CustomerUserFilter): Promise<NormalizedPage<User>> {
    const payload = {
      isSortByName: true,
      ...params,
    };
    const { data } = await apiClient.post<ApiPaginatedResponse<User>>(
      endpoints.customerUserSearch,
      payload,
    );
    return normalizePage(data);
  },

  async createCollaborator(
    payload: CustomerUserFormData,
    file?: File | null,
  ): Promise<ApiSingleResponse<User>> {
    const fd = toFormData(payload, file);
    const { data } = await apiClient.post<ApiSingleResponse<User>>(
      endpoints.userFormData,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async updateCollaborator(
    id: string,
    payload: Partial<CustomerUserFormData>,
    file?: File | null,
  ): Promise<ApiSingleResponse<User>> {
    const fd = toFormData(payload, file);
    const { data } = await apiClient.put<ApiSingleResponse<User>>(
      endpoints.userFormDataById(id),
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async deleteCollaborator(email: string, payload?: Record<string, unknown>): Promise<void> {
    await apiClient.delete(endpoints.userByEmail(email), { data: payload ?? {} });
  },

  async checkEmailExists(email: string): Promise<{ alreadyExist: boolean; _id?: string }> {
    try {
      const { data } = await apiClient.get<ApiSingleResponse<{ alreadyExist: boolean; _id?: string }>>(
        endpoints.checkEmailExists(email),
      );
      return data.result ?? { alreadyExist: false };
    } catch {
      return { alreadyExist: false };
    }
  },

  async checkUsernameExists(username: string): Promise<{ alreadyExist: boolean; _id?: string }> {
    try {
      const { data } = await apiClient.get<ApiSingleResponse<{ alreadyExist: boolean; _id?: string }>>(
        endpoints.checkUsernameExists(username),
      );
      return data.result ?? { alreadyExist: false };
    } catch {
      return { alreadyExist: false };
    }
  },
};
