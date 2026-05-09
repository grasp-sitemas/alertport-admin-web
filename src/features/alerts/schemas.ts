import { z } from 'zod';

/**
 * Alert schedule schema - mirrors shieldgo-admin-web/src/types/alertOccurenceSchedule.js
 * and the legacy CreateScheduleModal form validation.
 *
 * Required fields: account (only if SUPER_ADMIN_MASTER), client, site, equipment,
 * name, frequency, beginDate, endDate, beginHour, endHour, alertConfig.alertType.
 * Plus type-conditional: fixedInterval (FIXED), randomMin/randomMax (RANDOM).
 *
 * NOTE on null tolerance: legacy backend documents may legitimately ship
 * `null` for fields like `equipment`, `endDate`, or `_id`. Plain `z.string()`
 * rejects null with "expected string, received null" and the edit-series
 * form blows up before the user even sees it. Null/undefined values are
 * sanitized to '' at the form-defaults layer in `schedule-form-dialog.tsx`
 * (see `coerceNullableString`), so the schema can stay simple here and
 * keep its inferred input/output types as plain `string` for compatibility
 * with the React Hook Form Resolver.
 */

export const alertScheduleSchema = z
  .object({
    _id: z.string().optional(),
    name: z.string().min(1, { message: 'validation.required' }),
    account: z.string().optional(),
    client: z.string().min(1, { message: 'validation.required' }),
    site: z.string().min(1, { message: 'validation.required' }),
    equipment: z.string().min(1, { message: 'validation.required' }),
    frequency: z.enum([
      'NOT_REPEAT',
      'DAILY',
      'EVERY_OTHER_DAY',
      'WEEKLY',
      'MONTHLY',
      'YEARLY',
    ]),
    category: z.literal('ALERT_CHECK'),
    weeklyDays: z.array(z.number()).optional(),
    frequencyMonth: z
      .object({
        day: z.union([z.string(), z.number()]).optional(),
      })
      .optional(),
    frequencyYear: z
      .object({
        month: z.union([z.string(), z.number()]).optional(),
        day: z.union([z.string(), z.number()]).optional(),
      })
      .optional(),
    beginDate: z.string().min(1, { message: 'validation.required' }),
    endDate: z.string().min(1, { message: 'validation.required' }),
    beginHour: z.string().min(1, { message: 'validation.required' }),
    endHour: z.string().min(1, { message: 'validation.required' }),
    status: z.enum(['ACTIVE', 'ARCHIVED']),
    alertConfig: z.object({
      alertType: z.enum(['FIXED', 'RANDOM']),
      fixedInterval: z.number().optional(),
      durationMin: z.number().optional(),
      volumeLevel: z.number().min(0).max(100).optional(),
      randomMin: z.number().optional(),
      randomMax: z.number().optional(),
    }),
  })
  .refine(
    (data) => {
      if (data.alertConfig.alertType === 'FIXED') {
        return !!data.alertConfig.fixedInterval && data.alertConfig.fixedInterval >= 1;
      }
      if (data.alertConfig.alertType === 'RANDOM') {
        return (
          !!data.alertConfig.randomMin &&
          !!data.alertConfig.randomMax &&
          data.alertConfig.randomMin >= 1 &&
          data.alertConfig.randomMax >= data.alertConfig.randomMin
        );
      }
      return true;
    },
    { message: 'validation.required', path: ['alertConfig'] },
  )
  .refine(
    (data) => {
      if (data.frequency === 'WEEKLY') {
        return Array.isArray(data.weeklyDays) && data.weeklyDays.length > 0;
      }
      if (data.frequency === 'MONTHLY') {
        return !!data.frequencyMonth?.day && String(data.frequencyMonth.day).length > 0;
      }
      if (data.frequency === 'YEARLY') {
        return (
          !!data.frequencyYear?.month &&
          String(data.frequencyYear.month).length > 0 &&
          !!data.frequencyYear?.day &&
          String(data.frequencyYear.day).length > 0
        );
      }
      return true;
    },
    { message: 'validation.required', path: ['frequency'] },
  )
  .refine(
    (data) => data.endDate >= data.beginDate,
    {
      message: 'A data final deve ser igual ou posterior à data inicial',
      path: ['endDate'],
    },
  );

export type AlertScheduleFormValues = z.infer<typeof alertScheduleSchema>;

export const DEFAULT_ALERT_SCHEDULE: AlertScheduleFormValues = {
  name: '',
  account: '',
  client: '',
  site: '',
  equipment: '',
  frequency: 'DAILY',
  category: 'ALERT_CHECK',
  weeklyDays: [],
  frequencyMonth: { day: '' },
  frequencyYear: { month: '', day: '' },
  beginDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  beginHour: '08:00',
  endHour: '18:00',
  status: 'ACTIVE',
  alertConfig: {
    alertType: 'FIXED',
    fixedInterval: 30,
    durationMin: 2,
    volumeLevel: 80,
    randomMin: 0,
    randomMax: 0,
  },
};
