import { toast } from 'sonner';
import type { AxiosError } from 'axios';

/**
 * Errors the backend may return from AccessPolicyService.toMessage().
 * The frontend pivots on `code` rather than HTTP status so 403s from other
 * sources keep their existing behavior.
 */
export type TrialErrorCode =
  | 'TRIAL_EXPIRED'
  | 'TRIAL_LIMIT_REACHED'
  | 'FEATURE_NOT_AVAILABLE'
  | 'READ_ONLY_MODE';

interface TrialErrorBody {
  code?: TrialErrorCode;
  reason?: string;
  meta?: { resource?: string; limit?: number; used?: number };
}

/**
 * True iff this axios error carries a recognized trial code.
 */
export function isTrialError(err: unknown): err is AxiosError<TrialErrorBody> {
  if (!err || typeof err !== 'object') return false;
  const maybe = err as AxiosError<TrialErrorBody>;
  const code = maybe.response?.data?.code;
  return (
    code === 'TRIAL_EXPIRED' ||
    code === 'TRIAL_LIMIT_REACHED' ||
    code === 'FEATURE_NOT_AVAILABLE' ||
    code === 'READ_ONLY_MODE'
  );
}

/**
 * Render a friendly toast for a trial error. `t` is next-intl's `useTranslations`.
 */
export function toastTrialError(
  err: AxiosError<TrialErrorBody>,
  t: (key: string, vars?: Record<string, string | number>) => string,
): void {
  const body = err.response?.data;
  const code = body?.code;
  const meta = body?.meta ?? {};

  switch (code) {
    case 'TRIAL_EXPIRED':
      toast.error(t('trial.errors.expired'), { description: t('trial.errors.expiredDescription') });
      return;
    case 'TRIAL_LIMIT_REACHED':
      toast.error(
        t('trial.errors.limitReached', {
          resource: meta.resource ?? '',
          limit: String(meta.limit ?? ''),
        }),
        { description: t('trial.errors.limitReachedDescription') },
      );
      return;
    case 'FEATURE_NOT_AVAILABLE':
      toast.error(t('trial.errors.featureUnavailable'), {
        description: t('trial.errors.featureUnavailableDescription'),
      });
      return;
    case 'READ_ONLY_MODE':
      toast.error(t('trial.errors.readonly'), { description: t('trial.errors.readonlyDescription') });
      return;
    default:
      toast.error(t('notifications.errorOccurred'));
  }
}
