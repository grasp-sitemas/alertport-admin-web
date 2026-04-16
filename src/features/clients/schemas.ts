import { z } from 'zod';

export const clientFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, { message: 'validation.required' }),
  email: z.string().email({ message: 'validation.email' }).optional().or(z.literal('')),
  primaryPhone: z.string().optional(),
  owner: z.string().optional(),
  account: z.string().optional(),
  type: z.literal('CLIENT'),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const DEFAULT_CLIENT_VALUES: ClientFormValues = {
  name: '',
  email: '',
  primaryPhone: '',
  owner: '',
  account: '',
  type: 'CLIENT',
  status: 'ACTIVE',
};
