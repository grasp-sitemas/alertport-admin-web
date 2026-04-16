import axios from 'axios';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';

export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  gia?: string;
  erro?: boolean;
}

export interface GeoResponse {
  status: number;
  results?: Array<{
    geometry?: { location?: { lat: number; lng: number }; lat?: number; lng?: number };
  }>;
}

export const helpersService = {
  async getTimezones() {
    const { data } = await apiClient.get(endpoints.timezones);
    return data;
  },

  async getEquipmentBrands() {
    const { data } = await apiClient.get(endpoints.equipmentBrands);
    return data;
  },

  async getEquipmentTypes() {
    const { data } = await apiClient.get(endpoints.equipmentTypes);
    return data;
  },

  async getAttendanceTypes() {
    const { data } = await apiClient.get(endpoints.attendanceTypes);
    return data;
  },

  async getMonitorEventTypes() {
    const { data } = await apiClient.get(endpoints.monitorEventTypes);
    return data;
  },

  async lookupCep(cep: string): Promise<ViaCepResponse> {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return { erro: true };
    // ViaCEP is public, use plain axios to avoid injecting our auth headers
    const { data } = await axios.get<ViaCepResponse>(endpoints.viaCep(cleanCep), {
      timeout: 10000,
    });
    return data;
  },

  async geolocate(address: {
    cep?: string;
    address?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }): Promise<GeoResponse> {
    const { data } = await apiClient.post<GeoResponse>(endpoints.addressGeolocation, address);
    return data;
  },
};
