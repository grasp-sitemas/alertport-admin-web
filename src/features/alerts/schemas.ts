import { z } from 'zod';

export const alertScheduleSchema = z
  .object({
    _id: z.string().optional(),
    name: z.string().min(1, { message: 'validation.required' }),
    account: z.string().optional(),
    client: z.string().optional(),
    site: z.string().optional(),
    equipment: z.string().optional(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ONCE']),
    category: z.literal('ALERT_CHECK'),
    weeklyDays: z.array(z.number()).optional(),
    frequencyMonth: z.object({ day: z.string() }).optional(),
    frequencyYear: z.object({ month: z.string(), day: z.string() }).optional(),
    beginDate: z.string().min(1, { message: 'validation.required' }),
    endDate: z.string().nullable().optional(),
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
        return !!data.alertConfig.fixedInterval && data.alertConfig.fixedInterval > 0;
      }
      if (data.alertConfig.alertType === 'RANDOM') {
        return (
          !!data.alertConfig.randomMin &&
          !!data.alertConfig.randomMax &&
          data.alertConfig.randomMax >= data.alertConfig.randomMin
        );
      }
      return true;
    },
    { message: 'validation.required', path: ['alertConfig'] },
  );

export type AlertScheduleFormValues = z.infer<typeof alertScheduleSchema>;

export const DEFAULT_ALERT_SCHEDULE: AlertScheduleFormValues = {
  name: '',
  frequency: 'DAILY',
  category: 'ALERT_CHECK',
  beginDate: new Date().toISOString().slice(0, 10),
  endDate: null,
  beginHour: '08:00',
  endHour: '18:00',
  status: 'ACTIVE',
  alertConfig: {
    alertType: 'FIXED',
    fixedInterval: 30,
    durationMin: 2,
    volumeLevel: 80,
  },
};
