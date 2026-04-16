import { z } from 'zod';

export const collaboratorFormSchema = z.object({
  _id: z.string().optional(),
  firstName: z.string().min(1, { message: 'validation.required' }),
  lastName: z.string().min(1, { message: 'validation.required' }),
  email: z.string().email({ message: 'validation.email' }).optional().or(z.literal('')),
  username: z.string().optional(),
  primaryPhone: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
});

export type CollaboratorFormValues = z.infer<typeof collaboratorFormSchema>;

export const DEFAULT_COLLABORATOR_VALUES: CollaboratorFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  primaryPhone: '',
  status: 'ACTIVE',
};
