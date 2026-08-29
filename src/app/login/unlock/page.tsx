'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { authService } from '@/services/auth.service';

/**
 * Login-unlock confirmation page.
 *
 * Reached via the magic link in the "Liberar acesso" email
 * (`{FRONTEND_BASE_URL}/login/unlock?token=...`). The page reads the
 * token from the URL and POSTs it to the backend confirm endpoint,
 * which atomically deletes the jti from Redis (single-use) and
 * clears the per-account throttle state.
 *
 * Why we don't auto-submit on mount:
 *   Email security scanners often follow links to detect phishing.
 *   If we POSTed the token on mount, those scanners would consume
 *   the token before the real user clicks. Showing a confirm button
 *   keeps the token intact until a human acts.
 */
export default function LoginUnlockPage() {
  return (
    <Suspense fallback={<div className="bg-app-gradient min-h-screen" />}>
      <LoginUnlockPageContent />
    </Suspense>
  );
}

type Status = 'idle' | 'verifying' | 'success' | 'error';

function LoginUnlockPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();

  const token = (params.get('token') ?? '').trim();

  const [status, setStatus] = useState<Status>(() => (token ? 'idle' : 'error'));

  const confirm = useMutation({
    mutationFn: () => authService.confirmUnlock(token),
    onMutate: () => setStatus('verifying'),
    onSuccess: (response) => {
      if (response.status === 200) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    },
    onError: () => setStatus('error'),
  });

  return (
    <div className="bg-app-gradient relative flex min-h-screen flex-col overflow-hidden">
      <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-40" />
      <div className="bg-brand-600/10 pointer-events-none absolute top-0 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full blur-3xl" />

      <header className="relative z-10 flex items-center justify-end p-6">
        <LocaleSwitcher />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-8 shadow-[0_0_80px_rgba(179,38,30,0.08)] backdrop-blur-xl sm:p-10">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4">
                <Logo size="lg" showText={false} className="scale-125" />
              </div>

              {status === 'idle' && token && (
                <>
                  <h1 className="text-text-primary mb-2 text-xl font-semibold">
                    {t('auth.unlock.confirmTitle')}
                  </h1>
                  <p className="text-text-secondary mb-6 text-sm">
                    {t('auth.unlock.confirmDescription')}
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={() => confirm.mutate()}
                    disabled={confirm.isPending}
                  >
                    {t('auth.unlock.confirmCta')}
                  </Button>
                </>
              )}

              {status === 'verifying' && (
                <>
                  <Loader2 className="text-brand-400 mb-4 h-12 w-12 animate-spin" />
                  <p className="text-text-secondary text-sm">{t('auth.unlock.verifying')}</p>
                </>
              )}

              {status === 'success' && (
                <>
                  <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-400" />
                  <h1 className="text-text-primary mb-2 text-xl font-semibold">
                    {t('auth.unlock.successTitle')}
                  </h1>
                  <p className="text-text-secondary mb-6 text-sm">
                    {t('auth.unlock.successDescription')}
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={() => router.replace('/login')}
                  >
                    {t('auth.unlock.backToLogin')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {status === 'error' && (
                <>
                  <AlertTriangle className="mb-4 h-14 w-14 text-amber-400" />
                  <h1 className="text-text-primary mb-2 text-xl font-semibold">
                    {t('auth.unlock.errorTitle')}
                  </h1>
                  <p className="text-text-secondary mb-6 text-sm">
                    {t('auth.unlock.errorDescription')}
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.replace('/login')}
                  >
                    {t('auth.unlock.backToLogin')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
