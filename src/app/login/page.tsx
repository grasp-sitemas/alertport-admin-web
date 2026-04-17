'use client';

export const dynamic = 'force-dynamic';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/layout/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas';
import { useLogin } from '@/features/auth/use-login';
import { RecoveryPasswordDialog } from '@/features/auth/recovery-password-dialog';
import { SignupDialog } from '@/features/auth/signup-dialog';
import { isSessionValid } from '@/lib/session';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const login = useLogin();
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

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
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const currentEmail = useWatch({ control, name: 'email' });

  const onSubmit = (data: LoginFormValues) => {
    login.mutate({ email: data.email, login: data.email, password: data.password });
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-app-gradient overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6">
        <Logo size="md" />
        <LocaleSwitcher />
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl p-8 sm:p-10 shadow-[0_0_80px_rgba(179,38,30,0.08)]">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="mb-4">
                <Logo size="lg" showText={false} className="scale-125" />
              </div>
              <p className="text-sm text-text-secondary">{t('auth.loginSubtitle')}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
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
                    className="text-xs text-text-muted hover:text-white transition-colors underline-offset-2 hover:underline"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
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

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <>{t('common.loading')}</>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    {t('auth.login')}
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-wider text-text-muted">
                {t('auth.or')}
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Signup CTA */}
            <div className="text-center">
              <p className="text-sm text-text-secondary">{t('auth.noAccountYet')}</p>
              <button
                type="button"
                onClick={() => setSignupOpen(true)}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-brand-400 transition-colors hover:text-brand-300"
              >
                {t('auth.signupCta')}
                <span aria-hidden>→</span>
              </button>
              <p className="mt-3 text-xs text-text-muted">{t('auth.signupBenefit')}</p>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted mt-6">
            © {new Date().getFullYear()} AlertPort · {t('common.appName')}
          </p>
        </div>
      </main>

      <RecoveryPasswordDialog
        open={recoveryOpen}
        onOpenChange={setRecoveryOpen}
        defaultEmail={currentEmail}
      />
      <SignupDialog
        open={signupOpen}
        onOpenChange={setSignupOpen}
        onSuccess={(email) => {
          // Pre-fill /activate for the next step after the success screen closes.
          const params = new URLSearchParams();
          if (email) params.set('email', email);
          router.prefetch(`/activate${params.toString() ? '?' + params.toString() : ''}`);
        }}
      />
    </div>
  );
}
