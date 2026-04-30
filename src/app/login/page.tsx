'use client';

export const dynamic = 'force-dynamic';

import { useWatch } from 'react-hook-form';
import { useAppForm } from '@/hooks/use-app-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, KeyRound } from 'lucide-react';
import type { AxiosError } from 'axios';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/layout/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas';
import { useLogin } from '@/features/auth/use-login';
import { RecoveryPasswordDialog } from '@/features/auth/recovery-password-dialog';
import { RequestUnlockDialog } from '@/features/auth/request-unlock-dialog';
import { isSessionValid } from '@/lib/session';
import Link from 'next/link';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const login = useLogin();
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  useEffect(() => {
    if (isSessionValid()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useAppForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const currentEmail = useWatch({ control, name: 'email' });

  // The unlock CTA only appears AFTER the user hits the per-account
  // throttle (HTTP 429). Showing it always would be visual clutter
  // for the 99% case; gating on the error keeps the form clean and
  // surfaces the recovery path exactly when it's needed.
  const isThrottled = useMemo(() => {
    const err = login.error as AxiosError<{ messageId?: string }> | null | undefined;
    if (!err) return false;
    const status = err.response?.status;
    const messageId = err.response?.data?.messageId;
    return (
      status === 429 ||
      messageId === 'response.user.too.many.attempts' ||
      messageId === 'response.msg.error.rate-limited'
    );
  }, [login.error]);

  const onSubmit = (data: LoginFormValues) => {
    login.mutate({ email: data.email, login: data.email, password: data.password });
  };

  return (
    <div className="bg-app-gradient relative flex min-h-screen flex-col overflow-hidden">
      {/* Background pattern */}
      <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-40" />
      <div className="bg-brand-600/10 pointer-events-none absolute top-0 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full blur-3xl" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-end p-6">
        <LocaleSwitcher />
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-8 shadow-[0_0_80px_rgba(179,38,30,0.08)] backdrop-blur-xl sm:p-10">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-4">
                <Logo size="lg" showText={false} className="scale-125" />
              </div>
              <p className="text-text-secondary text-sm">{t('auth.loginSubtitle')}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="pl-10"
                    placeholder="seu@email.com"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400">{t(errors.email.message as string)}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <button
                    type="button"
                    onClick={() => setRecoveryOpen(true)}
                    className="text-text-muted text-xs underline-offset-2 transition-colors hover:text-white hover:underline"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="pl-10"
                    placeholder="••••••••"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400">{t(errors.password.message as string)}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={login.isPending}>
                {login.isPending ? (
                  <>{t('common.loading')}</>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    {t('auth.login')}
                  </>
                )}
              </Button>

              {isThrottled && (
                <button
                  type="button"
                  onClick={() => setUnlockOpen(true)}
                  className="flex w-full items-center justify-center gap-2 text-xs text-amber-300/90 underline-offset-2 transition-colors hover:text-amber-200 hover:underline"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {t('auth.unlock.requestCtaInline')}
                </button>
              )}
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-text-muted text-xs tracking-wider uppercase">
                {t('auth.or')}
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Signup CTA */}
            <div className="text-center">
              <p className="text-text-secondary text-sm">{t('auth.noAccountYet')}</p>
              <Link
                href="/register"
                className="text-brand-400 hover:text-brand-300 mt-2 inline-flex items-center gap-2 text-sm font-semibold transition-colors"
              >
                {t('auth.signupCta')}
                <span aria-hidden>→</span>
              </Link>
              <p className="text-text-muted mt-3 text-xs">{t('auth.signupBenefit')}</p>
            </div>
          </div>

          <p className="text-text-muted mt-6 text-center text-xs">
            © {new Date().getFullYear()} AlertPort · {t('common.appName')}
          </p>
          <div className="text-text-muted mt-3 flex items-center justify-center gap-4 text-xs">
            <Link
              href="/privacy"
              className="underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              Política de Privacidade
            </Link>
            <span aria-hidden className="text-white/20">
              ·
            </span>
            <Link
              href="/terms"
              className="underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              Termos de Uso
            </Link>
          </div>
        </div>
      </main>

      <RecoveryPasswordDialog
        open={recoveryOpen}
        onOpenChange={setRecoveryOpen}
        defaultEmail={currentEmail}
      />

      <RequestUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        defaultEmail={currentEmail}
      />
    </div>
  );
}
