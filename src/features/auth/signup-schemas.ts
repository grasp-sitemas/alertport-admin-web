import { z } from 'zod';
import { passesPasswordPolicy } from './password-policy';
import { isValidBrDocument, normalizeBrDocument } from '@/lib/br-documents';

// Company (step 1)
export const signupCompanySchema = z.object({
  name: z.string().trim().min(2, { message: 'validation.required' }),
  fantasyName: z.string().trim(),
  // Accepts CPF (11 digits) OR CNPJ - legacy numeric AND the new alphanumeric
  // CNPJ spec (IN RFB 2.229/2024). The transform strips separators and
  // uppercases letters so both branches validate uniformly.
  document: z
    .string()
    .trim()
    .min(1, { message: 'signup.company.documentInvalid' })
    .transform((v) => normalizeBrDocument(v))
    .refine((v) => v.length === 11 || v.length === 14, {
      message: 'signup.company.documentInvalid',
    })
    .refine((v) => isValidBrDocument(v), {
      message: 'signup.company.documentChecksumInvalid',
    }),
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
    password: z
      .string()
      .min(8, { message: 'signup.user.passwordMinLength' })
      .refine((v) => passesPasswordPolicy(v), {
        message: 'signup.password.failsPolicy',
      }),
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
