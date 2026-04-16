import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'validation.required' })
    .email({ message: 'validation.email' }),
  password: z.string().min(1, { message: 'validation.required' }),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
