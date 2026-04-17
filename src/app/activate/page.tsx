'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { AxiosError } from 'axios';
import { CheckCircle2, AlertTriangle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { signupService } from '@/services/signup.service';

/**
 * Link-based activation page.
 *
 * Flow:
 *   1. User clicks the "Ativar minha conta" button in the activation email,
 *      which points to `/activate?token=<base64url>&email=<email>`.
 *   2. On mount, we POST to /api/users/system/activation/confirm/v1 with
 *      { email, token }. While the request is in flight we show a
 *      "verifying" spinner.
 *   3. On success: big check + "Conta ativada" + CTA to /login.
 *   4. On failure (missing / invalid / expired / user not found): friendly
 *      error screen + "Reenviar link" button.
 *
 * No manual code input — we don't want users to type a 43-char base64 token.
 * If they lose the email, they press "Reenviar link".
 */
export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-app-gradient" />}>
      <ActivatePageContent />
    </Suspense>
  );
}

type Status = 'idle' | 'verifying' | 'success' | 'error';

function ActivatePageContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();

  const email = (params.get('email') ?? '').trim().toLowerCase();
  const token = (params.get('token') ?? '').trim();

  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const ranRef = useRef<boolean>(false);

  const confirm = useMutation({
    mutationFn: (args: { email: string; token: string }) =>
      signupService.confirm({ email: args.email, token: args.token }),
    onMutate: () => setStatus('verifying'),
    onSuccess: () => {
      setStatus('success');
    },
    onError: (err: AxiosError<{ code?: string }>) => {
      const code = err.response?.data?.code;
      const key =
        code === 'ACTIVATION_CODE_EXPIRED'
          ? 'signup.activation.expired'
          : code === 'ACTIVATION_CODE_INVALID'
            ? 'signup.activation.invalid'
            : code === 'ACTIVATION_CODE_MISSING'
              ? 'signup.activation.missingNoCode'
              : code === 'USER_NOT_FOUND'
                ? 'signup.activation.userNotFound'
                : 'signup.activation.generic';
      setErrorMessage(t(key));
      setStatus('error');
    },
  });

  const resend = useMutation({
    mutationFn: () => signupService.resend(email),
    onSuccess: () => {
      setErrorMessage(t('signup.activation.resentToast'));
    },
    onError: () => setErrorMessage(t('signup.activation.generic')),
  });

  // Run the activation exactly once on mount when we have a token + email.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (email && token) {
      confirm.mutate({ email, token });
    } else {
      setStatus('error');
      setErrorMessage(t('signup.activation.linkMissing'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col bg-app-gradient overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <header className="relative z-10 flex items-center justify-end p-6">
        <LocaleSwitcher />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl p-8 sm:p-10 shadow-[0_0_80px_rgba(179,38,30,0.08)]">
            {/* Central brand mark */}
            <div className="mb-6 flex justify-center">
              <Logo size="lg" showText={false} className="scale-125" />
            </div>

            {status === 'verifying' && <VerifyingView t={t} />}

            {status === 'success' && (
              <SuccessView
                t={t}
                onLogin={() => router.replace('/login')}
              />
            )}

            {status === 'error' && (
              <ErrorView
                t={t}
                message={errorMessage}
                canResend={!!email}
                onResend={() => resend.mutate()}
                isResending={resend.isPending}
                onBackToLogin={() => router.replace('/login')}
              />
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

// ─── Views ──────────────────────────────────────────────────────────────

function VerifyingView({ t }: { t: (k: string) => string }) {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
      <h1 className="text-xl font-semibold text-white">{t('signup.activation.verifyingTitle')}</h1>
      <p className="text-sm text-text-secondary">{t('signup.activation.verifyingSubtitle')}</p>
    </div>
  );
}

function SuccessView({ t, onLogin }: { t: (k: string) => string; onLogin: () => void }) {
  return (
    <div className="text-center space-y-5">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">
          {t('signup.activation.doneTitle')}
        </h1>
        <p className="text-sm text-text-secondary">
          {t('signup.activation.doneDescription')}
        </p>
      </div>
      <Button className="w-full" size="lg" onClick={onLogin}>
        {t('signup.activation.goToLogin')}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ErrorView({
  t,
  message,
  canResend,
  onResend,
  isResending,
  onBackToLogin,
}: {
  t: (k: string) => string;
  message: string;
  canResend: boolean;
  onResend: () => void;
  isResending: boolean;
  onBackToLogin: () => void;
}) {
  return (
    <div className="text-center space-y-5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/30">
        <AlertTriangle className="h-8 w-8 text-rose-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-white">
          {t('signup.activation.errorTitle')}
        </h1>
        <p className="text-sm text-text-secondary">{message}</p>
      </div>
      <div className="space-y-2">
        {canResend && (
          <Button className="w-full" size="lg" onClick={onResend} disabled={isResending}>
            {isResending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t('signup.activation.resendLinkCta')}
          </Button>
        )}
        <Button variant="ghost" className="w-full" onClick={onBackToLogin}>
          {t('signup.activation.backToLogin')}
        </Button>
      </div>
    </div>
  );
}
