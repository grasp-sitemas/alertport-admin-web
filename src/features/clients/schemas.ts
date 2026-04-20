import { z } from 'zod';

/**
 * Client (Company where type=CLIENT) form schema.
 *
 * Mirrors shieldgo-admin-web's Client.vue + CrtClient.vue required-field set:
 *   - name:    required
 *   - account: required (the client belongs to an ACCOUNT)
 *   - email, primaryPhone, owner: optional
 *
 * `primaryPhone` is stored as digits only - the UI input masks it for display.
 */
export const clientFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, { message: 'validation.required' }),
  email: z
    .string()
    .trim()
    .email({ message: 'validation.email' })
    .optional()
    .or(z.literal('')),
  primaryPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, '')),
  owner: z.string().trim(),
  // Non-empty ObjectId string. Mongoose rejects `""` when casting the ref,
  // so we require a concrete value here and fall back to the session account
  // for non-master users before hitting zod.
  account: z.string().trim().min(1, { message: 'clients.accountRequired' }),
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
