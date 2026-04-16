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
      });

      toast.success(t('auth.welcomeBack'));
      router.replace('/dashboard');
    },
    onError: (error: AxiosError<{ messageId?: string; message?: string }>) => {
      const messageId = error.response?.data?.messageId;

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
