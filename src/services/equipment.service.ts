import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';
import { normalizePage, type NormalizedPage } from '@/lib/pagination';
import type {
  ApiPaginatedResponse,
  ApiSingleResponse,
  Equipment,
  EquipmentFormData,
  FilterParams,
} from '@/types/api';

export const equipmentService = {
  async filter(params: FilterParams): Promise<NormalizedPage<Equipment>> {
    const { data } = await apiClient.post<ApiPaginatedResponse<Equipment>>(
      endpoints.equipmentsFilter,
      params,
    );
    return normalizePage(data);
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

  async archive(equipment: Equipment): Promise<void> {
    // Legacy contract: DELETE /api/company/equipments/v1/{id} with full body
    await apiClient.delete(endpoints.equipmentById(equipment._id), { data: equipment });
  },

  async getBrands(): Promise<Array<{ _id: string; name: string }>> {
    const { data } = await apiClient.get<ApiPaginatedResponse<{ _id: string; name: string }>>(
      endpoints.equipmentBrands,
    );
    return data?.results ?? [];
  },

  async getTypes(): Promise<Array<{ _id: string; name: string }>> {
    const { data } = await apiClient.get<ApiPaginatedResponse<{ _id: string; name: string }>>(
      endpoints.equipmentTypes,
    );
    return data?.results ?? [];
  },
};
