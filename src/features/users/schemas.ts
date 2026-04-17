import { z } from 'zod';
import { passesPasswordPolicy } from '@/features/auth/password-policy';

export const userFormSchema = z
  .object({
    _id: z.string().optional(),
    firstName: z.string().min(1, { message: 'validation.required' }),
    lastName: z.string().min(1, { message: 'validation.required' }),
    email: z.string().email({ message: 'validation.email' }),
    oldEmail: z.string().optional(),
    username: z.string().optional(),
    oldUsername: z.string().optional(),
    primaryPhone: z.string().optional(),
    // When present, password must meet the app-wide policy (min 8, uppercase,
    // special char, no sequential digits). When empty/undefined — typical on
    // EDIT — the field is skipped entirely and the server keeps the old hash.
    password: z
      .string()
      .optional()
      .refine((v) => !v || v.length === 0 || passesPasswordPolicy(v), {
        message: 'signup.password.failsPolicy',
      }),
    confirmPassword: z.string().optional(),
    photoURL: z.string().optional(),
    account: z.string().optional(),
    client: z.string().optional(),
    site: z.string().optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']),
    companyUser: z.object({
      subtype: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'AUDITOR']),
      status: z.enum(['ACTIVE', 'ARCHIVED']),
    }),
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
  })
  .refine(
    (data) => {
      if (data.password || data.confirmPassword) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    { message: 'validation.passwordMatch', path: ['confirmPassword'] },
  )
  .refine(
    (data) => {
      // MANAGER/OPERATOR/AUDITOR need at least a client (legacy rule)
      if (['MANAGER', 'OPERATOR', 'AUDITOR'].includes(data.companyUser.subtype)) {
        return !!data.client;
      }
      return true;
    },
    { message: 'validation.required', path: ['client'] },
  );

export type UserFormValues = z.infer<typeof userFormSchema>;

export const DEFAULT_USER_VALUES: UserFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  primaryPhone: '',
  photoURL: '',
  account: '',
  client: '',
  site: '',
  status: 'ACTIVE',
  companyUser: {
    subtype: 'OPERATOR',
    status: 'ACTIVE',
  },
  address: {
    cep: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'BR',
    ibge: '',
    gia: '',
    name: 'MAIN',
  },
};
