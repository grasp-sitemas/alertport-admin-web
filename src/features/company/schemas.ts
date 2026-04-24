import { z } from 'zod';

export const companyFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, { message: 'validation.required' }),
  fantasyName: z.string().optional(),
  personType: z.enum(['PHYSICAL', 'LEGAL']).optional(),
  document: z.string().optional(),
  email: z.string().email({ message: 'validation.email' }).optional().or(z.literal('')),
  primaryPhone: z.string().optional(),
  secondaryPhone: z.string().optional(),
  timezone: z.string().optional(),
  logoURL: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  // Accept any legacy type string - whitelabel admins edit records with
  // `type: 'WHITE-LABEL-COMPANY'`, which the previous enum rejected (silently
  // blocking the Save submit with no visible error next to any field).
  type: z.string().optional(),
  address: z
    .object({
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
    })
    .optional(),
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;

/**
 * Account/Company list CRUD schema (Company where type=ACCOUNT).
 * Used exclusively by the SUPER_ADMIN_MASTER "Empresas" screen to create,
 * edit and toggle status of accounts across the platform.
 *
 * `primaryPhone` is stored as digits only - the UI input masks it for display.
 */
export const companyListFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, { message: 'validation.required' }),
  fantasyName: z.string().trim().optional().or(z.literal('')),
  personType: z.enum(['PHYSICAL', 'LEGAL']).optional(),
  document: z.string().trim().optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .email({ message: 'validation.email' })
    .optional()
    .or(z.literal('')),
  primaryPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, '')),
  type: z.literal('ACCOUNT'),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
});

export type CompanyListFormValues = z.infer<typeof companyListFormSchema>;

export const DEFAULT_COMPANY_LIST_VALUES: CompanyListFormValues = {
  name: '',
  fantasyName: '',
  personType: undefined,
  document: '',
  email: '',
  primaryPhone: '',
  type: 'ACCOUNT',
  status: 'ACTIVE',
};
