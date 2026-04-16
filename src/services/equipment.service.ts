import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import type {
  ApiPaginatedResponse,
  ApiSingleResponse,
  Equipment,
  EquipmentFormData,
  FilterParams,
} from '@/types/api';

export const equipmentService = {
  async filter(params: FilterParams): Promise<ApiPaginatedResponse<Equipment>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Equipment>>(
      endpoints.equipmentsFilter,
      params,
    );
    return data;
  },

  async getById(id: string): Promise<ApiSingleResponse<Equipment>> {
    const { data } = await apiClient.get<ApiSingleResponse<Equipment>>(
      endpoints.equipmentById(id),
    );
    return data;
  },

  async create(equipmentData: EquipmentFormData): Promise<ApiSingleResponse<Equipment>> {
    const { data } = await apiClient.post<ApiSingleResponse<Equipment>>(
      endpoints.equipments,
      equipmentData,
    );
    return data;
  },

  async update(
    id: string,
    equipmentData: Partial<EquipmentFormData>,
  ): Promise<ApiSingleResponse<Equipment>> {
    const { data } = await apiClient.put<ApiSingleResponse<Equipment>>(
      endpoints.equipmentById(id),
      equipmentData,
    );
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.post(endpoints.deleteEquipment, { _id: id });
  },

  async getBrands() {
    const { data } = await apiClient.get(endpoints.equipmentBrands);
    return data;
  },

  async getTypes() {
    const { data } = await apiClient.get(endpoints.equipmentTypes);
    return data;
  },
};
