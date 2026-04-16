import { z } from 'zod';

export const collaboratorFormSchema = z
  .object({
    _id: z.string().optional(),
    firstName: z.string().min(1, { message: 'validation.required' }),
    lastName: z.string().min(1, { message: 'validation.required' }),
    email: z.string().email({ message: 'validation.email' }),
    oldEmail: z.string().optional(),
    username: z.string().min(1, { message: 'validation.required' }),
    oldUsername: z.string().optional(),
    primaryPhone: z.string().optional(),
    password: z.string().optional(),
    photoURL: z.string().optional(),
    account: z.string().min(1, { message: 'validation.required' }),
    client: z.string().min(1, { message: 'validation.required' }),
    site: z.string().min(1, { message: 'validation.required' }),
    customerUser: z.object({
      subtype: z.enum(['VIGILANT', 'SUPERVISOR']),
      status: z.enum(['ACTIVE', 'ARCHIVED']),
      employeeCode: z.string().optional(),
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
        ibge: z.string().optional(),
        gia: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    type: z.literal('USER-CUSTOMER'),
    status: z.enum(['ACTIVE', 'ARCHIVED']),
  })
  .refine(
    (data) => {
      // On create (no _id), password is required
      if (!data._id) {
        return !!data.password && data.password.length > 0;
      }
      return true;
    },
    { message: 'validation.required', path: ['password'] },
  );

export type CollaboratorFormValues = z.infer<typeof collaboratorFormSchema>;

export const DEFAULT_COLLABORATOR_VALUES: CollaboratorFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  primaryPhone: '',
  photoURL: '',
  password: '',
  account: '',
  client: '',
  site: '',
  customerUser: {
    subtype: 'VIGILANT',
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
    name: 'MAIN',
  },
  type: 'USER-CUSTOMER',
  status: 'ACTIVE',
};
