import { z } from 'zod';

export const equipmentFormSchema = z.object({
  _id: z.string().optional(),
  legacyId: z.string().optional(),
  account: z.string().min(1, { message: 'validation.required' }),
  client: z.string().min(1, { message: 'validation.required' }),
  site: z.string().min(1, { message: 'validation.required' }),
  code: z.string().min(1, { message: 'validation.required' }),
  type: z.string().optional(),
  brand: z.string().optional(),
  user: z.string().optional(),
  hasImport: z.boolean().optional(),
  companyLegacyParentId: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
});

export type EquipmentFormValues = z.infer<typeof equipmentFormSchema>;

export const DEFAULT_EQUIPMENT_VALUES: EquipmentFormValues = {
  legacyId: '',
  account: '',
  client: '',
  site: '',
  code: '',
  type: '',
  brand: '',
  user: '',
  hasImport: true,
  companyLegacyParentId: '',
  status: 'ACTIVE',
};
