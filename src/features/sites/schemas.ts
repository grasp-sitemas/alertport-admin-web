import { z } from 'zod';

export const addressSchema = z.object({
  cep: z.string().optional(),
  address: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  ibge: z.string().optional(),
  gia: z.string().optional(),
  name: z.string().optional(),
  lat: z.union([z.string(), z.number()]).optional(),
  lng: z.union([z.string(), z.number()]).optional(),
});

export const siteFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, { message: 'validation.required' }),
  account: z.string().optional(),
  client: z.string().min(1, { message: 'validation.required' }),
  primaryPhone: z.string().optional(),
  owner: z.string().optional(),
  // enableFreePatrol intentionally removed - ShieldGo-only feature.
  address: addressSchema,
  type: z.literal('SITE'),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
});

export type SiteFormValues = z.infer<typeof siteFormSchema>;

export const DEFAULT_SITE_VALUES: SiteFormValues = {
  name: '',
  client: '',
  account: '',
  primaryPhone: '',
  owner: '',
  address: {
    cep: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'BR',
    name: 'MAIN',
  },
  type: 'SITE',
  status: 'ACTIVE',
};
