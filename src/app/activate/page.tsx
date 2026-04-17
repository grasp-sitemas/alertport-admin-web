'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Mail, KeyRound, ShieldCheck, CheckCircle2, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/layout/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { signupService } from '@/services/signup.service';
import {
  activationConfirmSchema,
  type ActivationConfirmValues,
} from '@/features/auth/signup-schemas';

export default function ActivatePage() {
  // Next's CSR bailout requires useSearchParams to sit inside a Suspense boundary.
  return (
    <Suspense fallback={<div className="min-h-screen bg-app-gradient" />}>
      <ActivatePageContent />
    </Suspense>
  );
}

function ActivatePageContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ActivationConfirmValues>({
    resolver: zodResolver(activationConfirmSchema),
    defaultValues: {
      email: params.get('email') ?? '',
      code: params.get('code') ?? '',
    },
  });

  // Auto-submit if both email + code come from the URL (e.g. user clicked
  // a future "activation link"). Commented out until a link-style activation
  // is adopted to keep this form idempotent.
  useEffect(() => {
    const e = params.get('email');
    const c = params.get('code');
    if (e) setValue('email', e);
    if (c) setValue('code', c.toUpperCase());
  }, [params, setValue]);

  const confirm = useMutation({
    mutationFn: (values: ActivationConfirmValues) =>
      signupService.confirm({ email: values.email, code: values.code }),
    onSuccess: () => {
      setDone(true);
      toast.success(t('signup.activation.successToast'));
    },
    onError: (err: AxiosError<{ code?: string }>) => {
      const code = err.response?.data?.code;
      if (code === 'ACTIVATION_CODE_EXPIRED') {
        toast.error(t('signup.activation.expired'));
      } else if (code === 'ACTIVATION_CODE_INVALID') {
        toast.error(t('signup.activation.invalid'));
      } else if (code === 'USER_NOT_FOUND') {
        toast.error(t('signup.activation.userNotFound'));
      } else {
        toast.error(t('signup.activation.generic'));
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => signupService.resend(getValues('email')),
    onSuccess: () => toast.success(t('signup.activation.resentToast')),
    onError: () => toast.error(t('signup.activation.generic')),
  });

  const onSubmit = (data: ActivationConfirmValues) => confirm.mutate(data);

  return (
    <div className="relative min-h-screen flex flex-col bg-app-gradient overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between p-6">
        <Logo size="md" />
        <LocaleSwitcher />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl p-8 sm:p-10 shadow-[0_0_80px_rgba(179,38,30,0.08)]">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/20">
                {done ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-brand-400" />
                )}
              </div>
              <h1 className="text-xl font-semibold text-white">
                {done ? t('signup.activation.doneTitle') : t('signup.activation.title')}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                {done ? t('signup.activation.doneSubtitle') : t('signup.activation.subtitle')}
              </p>
            </div>

            {!done && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('signup.user.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="pl-10"
                      placeholder="voce@empresa.com"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-400">{t(errors.email.message as string)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">{t('signup.activation.codeLabel')}</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <Input
                      id="code"
                      autoComplete="one-time-code"
                      className="pl-10 font-mono uppercase tracking-[0.35em] text-center"
                      placeholder="ABC123"
                      maxLength={6}
                      {...register('code', {
                        onChange: (e) =>
                          setValue('code', e.target.value.toUpperCase(), { shouldValidate: false }),
                      })}
                    />
                  </div>
                  {errors.code && (
                    <p className="text-xs text-red-400">{t(errors.code.message as string)}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={confirm.isPending}
                >
                  {confirm.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      {t('signup.activation.confirmCta')}
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => resend.mutate()}
                    disabled={resend.isPending || !getValues('email')}
                    className="inline-flex items-center gap-1 text-text-muted hover:text-white disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${resend.isPending ? 'animate-spin' : ''}`} />
                    {t('signup.activation.resendCta')}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.replace('/login')}
                    className="text-text-muted hover:text-white"
                  >
                    {t('signup.activation.backToLogin')}
                  </button>
                </div>
              </form>
            )}

            {done && (
              <div className="space-y-5 text-center">
                <p className="text-sm text-text-secondary">
                  {t('signup.activation.doneDescription')}
                </p>
                <Button className="w-full" size="lg" onClick={() => router.replace('/login')}>
                  {t('auth.login')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-text-muted mt-6">
            © {new Date().getFullYear()} AlertPort · {t('common.appName')}
          </p>
        </div>
      </main>
    </div>
  );
}
