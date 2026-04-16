'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { Mail, Key, Lock, Eye, EyeOff, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { authService } from '@/services/auth.service';
import {
  recoveryEmailSchema,
  recoveryResetSchema,
  type RecoveryEmailValues,
  type RecoveryResetValues,
} from './schemas';

type Step = 1 | 2 | 3;

interface RecoveryPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill email from the login form when the user clicks "forgot password" */
  defaultEmail?: string;
}

export function RecoveryPasswordDialog({
  open,
  onOpenChange,
  defaultEmail = '',
}: RecoveryPasswordDialogProps) {
  const t = useTranslations();
  const [step, setStep] = useState<Step>(1);
  const [systemUser, setSystemUser] = useState<string>('');
  const [email, setEmail] = useState<string>(defaultEmail);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const emailForm = useForm<RecoveryEmailValues>({
    resolver: zodResolver(recoveryEmailSchema),
    defaultValues: { email: defaultEmail },
  });

  const resetForm = useForm<RecoveryResetValues>({
    resolver: zodResolver(recoveryResetSchema),
    defaultValues: { code: '', password: '', passwordConfirm: '' },
  });

  // Reset everything whenever the dialog is closed/reopened
  useEffect(() => {
    if (open) {
      setStep(1);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setSystemUser('');
      setEmail(defaultEmail);
      emailForm.reset({ email: defaultEmail });
      resetForm.reset({ code: '', password: '', passwordConfirm: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEmail]);

  // ── Step 1: generate code ───────────────────────────────────────
  const generateCode = useMutation({
    mutationFn: (e: string) => authService.generatePasswordCode(e),
    onSuccess: (data) => {
      const id = data?.result?.systemUser;
      if (!id) {
        toast.error(t('auth.recovery.genericError'));
        return;
      }
      setSystemUser(id);
      setStep(2);
    },
    onError: (err: AxiosError<{ messageId?: string }>) => {
      const msgId = err.response?.data?.messageId;
      if (
        err.response?.status === 404 ||
        msgId === 'response.user.not.found' ||
        msgId === 'response.user.email.not.found'
      ) {
        toast.error(t('auth.recovery.emailNotFound'));
      } else {
        toast.error(t('auth.recovery.genericError'));
      }
    },
  });

  // ── Step 2: reset password ──────────────────────────────────────
  const resetPassword = useMutation({
    mutationFn: (values: RecoveryResetValues) =>
      authService.resetPassword({
        code: values.code.toUpperCase(),
        systemUser,
        password: values.password,
      }),
    onSuccess: () => {
      setStep(3);
    },
    onError: (err: AxiosError<{ messageId?: string }>) => {
      const msgId = err.response?.data?.messageId;
      if (msgId === 'response.user.code.incorrect') {
        toast.error(t('auth.recovery.codeIncorrect'));
      } else {
        toast.error(t('auth.recovery.genericError'));
      }
    },
  });

  const onEmailSubmit = emailForm.handleSubmit(({ email: e }) => {
    setEmail(e);
    generateCode.mutate(e);
  });

  const onResetSubmit = resetForm.handleSubmit((data) => {
    resetPassword.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">
            {t('auth.recovery.title')}
          </DialogTitle>
          <DialogDescription>{t('auth.recovery.subtitle')}</DialogDescription>
        </DialogHeader>

        <StepIndicator step={step} />

        {step === 1 && (
          <form onSubmit={onEmailSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  className="pl-10"
                  placeholder={t('auth.recovery.emailPlaceholder')}
                  {...emailForm.register('email')}
                />
              </div>
              {emailForm.formState.errors.email && (
                <p className="text-xs text-red-400">
                  {t(emailForm.formState.errors.email.message as string)}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={generateCode.isPending}
            >
              {generateCode.isPending ? t('common.loading') : t('auth.recovery.sendCode')}
              {!generateCode.isPending && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={onResetSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="recovery-code">{t('auth.recovery.codeLabel')}</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  id="recovery-code"
                  autoComplete="one-time-code"
                  className="pl-10 tracking-[0.35em] uppercase font-mono text-center"
                  placeholder={t('auth.recovery.codePlaceholder')}
                  maxLength={8}
                  {...resetForm.register('code', {
                    onChange: (e) => {
                      // Force uppercase as the user types (legacy behaviour)
                      e.target.value = e.target.value.toUpperCase();
                    },
                  })}
                />
              </div>
              <p className="text-xs text-text-muted">{t('auth.recovery.codeHelp')}</p>
              {resetForm.formState.errors.code && (
                <p className="text-xs text-red-400">
                  {t(resetForm.formState.errors.code.message as string)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="recovery-new-password">{t('auth.recovery.newPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  id="recovery-new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pl-10 pr-10"
                  placeholder={t('auth.recovery.newPasswordPlaceholder')}
                  {...resetForm.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {resetForm.formState.errors.password && (
                <p className="text-xs text-red-400">
                  {t(resetForm.formState.errors.password.message as string)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="recovery-confirm-password">
                {t('auth.recovery.confirmPassword')}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  id="recovery-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pl-10 pr-10"
                  placeholder={t('auth.recovery.confirmPasswordPlaceholder')}
                  {...resetForm.register('passwordConfirm')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {resetForm.formState.errors.passwordConfirm && (
                <p className="text-xs text-red-400">
                  {t(resetForm.formState.errors.passwordConfirm.message as string)}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                size="lg"
                onClick={() => {
                  setStep(1);
                  emailForm.reset({ email });
                }}
                disabled={resetPassword.isPending}
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common.back')}
              </Button>
              <Button
                type="submit"
                className="flex-1"
                size="lg"
                disabled={resetPassword.isPending}
              >
                {resetPassword.isPending
                  ? t('common.loading')
                  : t('auth.recovery.changePassword')}
                {!resetPassword.isPending && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>

            <button
              type="button"
              onClick={() => email && generateCode.mutate(email)}
              disabled={generateCode.isPending || !email}
              className="block mx-auto text-xs text-text-muted hover:text-white transition-colors underline-offset-2 hover:underline disabled:opacity-50"
            >
              {generateCode.isPending
                ? t('common.loading')
                : t('auth.recovery.resend')}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" strokeWidth={2} />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {t('auth.recovery.successTitle')}
              </p>
              <p className="text-sm text-text-secondary mt-1">
                {t('auth.recovery.successDescription')}
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={() => onOpenChange(false)}>
              {t('auth.recovery.backToLogin')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const t = useTranslations();
  const items: { n: Step; label: string }[] = [
    { n: 1, label: t('auth.recovery.stepEmail') },
    { n: 2, label: t('auth.recovery.stepCode') },
    { n: 3, label: t('auth.recovery.stepDone') },
  ];

  return (
    <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10">
      {items.map((item, idx) => {
        const done = step > item.n;
        const active = step === item.n;
        return (
          <div key={item.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all',
                  done && 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
                  active &&
                    'bg-brand-600/20 border-brand-600/50 text-brand-400 shadow-[0_0_20px_rgba(179,38,30,0.35)]',
                  !done && !active && 'bg-white/5 border-white/10 text-text-muted',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : item.n}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium',
                  active ? 'text-white' : 'text-text-muted',
                )}
              >
                {item.label}
              </span>
            </div>
            {idx < items.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-2 transition-colors',
                  step > item.n ? 'bg-emerald-500/40' : 'bg-white/10',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
