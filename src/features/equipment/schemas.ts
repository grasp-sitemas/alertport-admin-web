import { z } from 'zod';

export const equipmentFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, { message: 'validation.required' }),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
});

export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>;

export const DEFAULT_EQUIPMENT_VALUES: EquipmentFormValues = {
  name: '',
  brand: '',
  model: '',
  serialNumber: '',
  status: 'ACTIVE',
};
