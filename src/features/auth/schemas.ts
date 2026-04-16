import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'validation.required' })
    .email({ message: 'validation.email' }),
  password: z.string().min(1, { message: 'validation.required' }),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ──────────────────────────────────────────────────────────────
// Recovery password — mirrors shieldgo-admin-web/src/pages/Login/RecoveryPassword
// ──────────────────────────────────────────────────────────────

/** Step 1 — ask for email */
export const recoveryEmailSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'validation.required' })
    .email({ message: 'validation.email' }),
});

export type RecoveryEmailValues = z.infer<typeof recoveryEmailSchema>;

/** Step 2 — code (8 chars uppercase) + new password + confirmation */
export const recoveryResetSchema = z
  .object({
    code: z
      .string()
      .min(1, { message: 'validation.required' })
      .transform((v) => v.toUpperCase())
      .refine((v) => v.length === 8, { message: 'auth.recovery.codeInvalid' }),
    password: z.string().min(6, { message: 'auth.recovery.passwordMinLength' }),
    passwordConfirm: z.string().min(1, { message: 'validation.required' }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'validation.passwordMatch',
    path: ['passwordConfirm'],
  });

export type RecoveryResetValues = z.infer<typeof recoveryResetSchema>;
