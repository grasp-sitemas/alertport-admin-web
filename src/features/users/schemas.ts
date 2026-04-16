import { z } from 'zod';

export const userFormSchema = z
  .object({
    _id: z.string().optional(),
    firstName: z.string().min(1, { message: 'validation.required' }),
    lastName: z.string().min(1, { message: 'validation.required' }),
    email: z.string().email({ message: 'validation.email' }),
    username: z.string().optional(),
    primaryPhone: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']),
    companyUser: z.object({
      subtype: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR']),
      status: z.enum(['ACTIVE', 'ARCHIVED']),
    }),
  })
  .refine(
    (data) => {
      if (data.password || data.confirmPassword) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    { message: 'validation.passwordMatch', path: ['confirmPassword'] },
  );

export type UserFormValues = z.infer<typeof userFormSchema>;

export const DEFAULT_USER_VALUES: UserFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  primaryPhone: '',
  status: 'ACTIVE',
  companyUser: {
    subtype: 'OPERATOR',
    status: 'ACTIVE',
  },
};
