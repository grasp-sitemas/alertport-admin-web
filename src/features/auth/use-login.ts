'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { authService } from '@/services/auth.service';
import { useAuth, validateLoginUser } from '@/hooks/use-auth';
import type { LoginRequest } from '@/types/api';
import type { AxiosError } from 'axios';

export function useLogin() {
  const router = useRouter();
  const { login } = useAuth();
  const t = useTranslations();

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await authService.login(credentials);
      if (response.status !== 200 || !response.token || !response.result) {
        throw new Error('auth.loginError');
      }
      return response;
    },
    onSuccess: (data) => {
      const validation = validateLoginUser(data.result);
      if (!validation.valid) {
        toast.error(t(validation.errorKey!));
        return;
      }

      login({
        token: data.token,
        user: data.result,
        language: data.result.language || 'pt',
        // Default to 'ALERTPORT' on this app so the X-Product header is
        // always sent — backend cross-checks against hostname and rejects
        // mismatches. Falls back gracefully if backend predates the rollout.
        product: data.product ?? 'ALERTPORT',
      });

      toast.success(t('auth.welcomeBack'));
      router.replace('/dashboard');
    },
    onError: (
      error: AxiosError<{
        messageId?: string;
        message?: string;
        code?: string;
        email?: string;
        retryAfterSec?: number;
      }>,
    ) => {
      const body = error.response?.data;
      const messageId = body?.messageId;

      // Self-signup: user registered but never confirmed the activation code.
      // Redirect to /activate with the email pre-filled.
      if (body?.code === 'EMAIL_NOT_VERIFIED' || messageId === 'response.user.email.not.verified') {
        const email = body?.email ?? '';
        toast.warning(t('signup.activation.notVerifiedToast'));
        const params = new URLSearchParams();
        if (email) params.set('email', email);
        router.push(`/activate${params.toString() ? '?' + params.toString() : ''}`);
        return;
      }

      // Per-account throttle hit (or per-IP cap from api-gateway).
      // The login page reads `login.error` to show the unlock-email
      // CTA next to the form.
      if (
        error.response?.status === 429 ||
        messageId === 'response.user.too.many.attempts' ||
        messageId === 'response.msg.error.rate-limited'
      ) {
        const seconds = Number(body?.retryAfterSec) || 0;
        if (seconds > 0) {
          toast.warning(t('auth.unlock.throttledToastWithSeconds', { seconds }));
        } else {
          toast.warning(t('auth.unlock.throttledToast'));
        }
        return;
      }

      if (messageId === 'response.user.archived') {
        toast.error(t('auth.loginArchivedUser'));
      } else if (messageId === 'response.company.archived') {
        toast.error(t('auth.loginArchivedCompany'));
      } else if (messageId === 'response.user.password.incorrect') {
        toast.error(t('auth.loginError'));
      } else if (error.response?.status === 401 || error.response?.status === 400) {
        toast.error(t('auth.loginError'));
      } else {
        toast.error(t('notifications.errorOccurred'));
      }
    },
  });
}
