import { z } from 'zod';

// Company (step 1)
export const signupCompanySchema = z.object({
  name: z.string().trim().min(2, { message: 'validation.required' }),
  fantasyName: z.string().trim(),
  document: z
    .string()
    .trim()
    .min(11, { message: 'signup.company.documentInvalid' })
    .transform((v) => v.replace(/[^\d]/g, '')),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'validation.required' })
    .email({ message: 'validation.email' }),
  primaryPhone: z
    .string()
    .trim()
    .min(8, { message: 'validation.required' })
    .transform((v) => v.replace(/[^\d]/g, '')),
  timezone: z.string().trim().min(1),
});
export type SignupCompanyValues = z.infer<typeof signupCompanySchema>;

// Admin user (step 2)
export const signupUserSchema = z
  .object({
    firstName: z.string().trim().min(1, { message: 'validation.required' }),
    lastName: z.string().trim().min(1, { message: 'validation.required' }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { message: 'validation.required' })
      .email({ message: 'validation.email' }),
    primaryPhone: z.string().trim(),
    password: z.string().min(8, { message: 'signup.user.passwordMinLength' }),
    passwordConfirm: z.string().min(1, { message: 'validation.required' }),
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: 'signup.user.termsRequired',
    }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'validation.passwordMatch',
  });
export type SignupUserValues = z.infer<typeof signupUserSchema>;

// Activation confirmation
export const activationConfirmSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'validation.required' })
    .email({ message: 'validation.email' }),
  code: z
    .string()
    .trim()
    .min(1, { message: 'validation.required' })
    .transform((v) => v.toUpperCase())
    .refine((v) => v.length === 6, { message: 'signup.activation.codeInvalid' }),
});
export type ActivationConfirmValues = z.infer<typeof activationConfirmSchema>;
