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
  type: z.enum(['ACCOUNT', 'CLIENT', 'SITE']).optional(),
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
