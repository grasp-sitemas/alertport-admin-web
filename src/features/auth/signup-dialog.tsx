'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import {
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  FileText,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Globe,
  Loader2,
  Sparkles,
} from 'lucide-react';
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
import { signupService } from '@/services/signup.service';
import {
  signupCompanySchema,
  signupUserSchema,
  type SignupCompanyValues,
  type SignupUserValues,
} from './signup-schemas';

type Step = 1 | 2 | 3;

interface SignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful signup with the registered email, so the caller
   *  can pre-fill the activate page / screen. */
  onSuccess?: (email: string) => void;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

function formatDocument(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    // CPF
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  // CNPJ
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3');
  }
  return d.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3');
}

export function SignupDialog({ open, onOpenChange, onSuccess }: SignupDialogProps) {
  const t = useTranslations();
  const [step, setStep] = useState<Step>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const detectedTz = useMemo(detectTimezone, []);

  const companyForm = useForm<SignupCompanyValues>({
    resolver: zodResolver(signupCompanySchema),
    defaultValues: {
      name: '',
      fantasyName: '',
      document: '',
      email: '',
      primaryPhone: '',
      timezone: detectedTz,
    },
  });

  const userForm = useForm<SignupUserValues>({
    resolver: zodResolver(signupUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      primaryPhone: '',
      password: '',
      passwordConfirm: '',
      acceptTerms: false as unknown as true,
    },
  });

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setShowPassword(false);
      setShowPasswordConfirm(false);
      companyForm.reset({
        name: '',
        fantasyName: '',
        document: '',
        email: '',
        primaryPhone: '',
        timezone: detectedTz,
      });
      userForm.reset({
        firstName: '',
        lastName: '',
        email: '',
        primaryPhone: '',
        password: '',
        passwordConfirm: '',
        acceptTerms: false as unknown as true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Mutation: final submit ─────────────────────────────────────
  const signup = useMutation({
    mutationFn: async () => {
      const company = companyForm.getValues();
      const user = userForm.getValues();
      return signupService.signup({
        company,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          password: user.password,
          primaryPhone: user.primaryPhone || company.primaryPhone,
          language: 'pt',
        },
      });
    },
    onSuccess: (data) => {
      setStep(3);
      onSuccess?.(data.email);
    },
    onError: (err: AxiosError<{ code?: string; messageId?: string; errors?: unknown[] }>) => {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_ALREADY_EXISTS') {
        toast.error(t('signup.errors.emailAlreadyExists'));
        setStep(2);
        userForm.setError('email', { message: 'signup.errors.emailAlreadyExists' });
        return;
      }
      if (code === 'COMPANY_CREATE_FAILED') {
        toast.error(t('signup.errors.companyCreateFailed'));
        setStep(1);
        return;
      }
      toast.error(t('signup.errors.generic'));
    },
  });

  const goToStep2 = companyForm.handleSubmit(() => setStep(2));
  const submitFinal = userForm.handleSubmit(() => signup.mutate());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden bg-gradient-to-b from-bg-secondary to-bg-primary border border-white/10 p-0 sm:rounded-3xl">
        {/* Premium ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl" />
        </div>

        <div className="relative z-10 p-8 sm:p-10">
          {step !== 3 && <Stepper current={step} />}

          <DialogHeader className="mt-4 mb-6 text-center sm:text-left">
            <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
              {step === 1 && <Building2 className="h-5 w-5 text-brand-500" />}
              {step === 2 && <User className="h-5 w-5 text-brand-500" />}
              {step === 3 && <ShieldCheck className="h-5 w-5 text-emerald-500" />}
              <DialogTitle className="text-2xl font-semibold text-white">
                {step === 1 && t('signup.company.title')}
                {step === 2 && t('signup.user.title')}
                {step === 3 && t('signup.success.title')}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-text-secondary">
              {step === 1 && t('signup.company.subtitle')}
              {step === 2 && t('signup.user.subtitle')}
              {step === 3 && t('signup.success.subtitle')}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <form onSubmit={goToStep2} className="space-y-5">
              <Field
                label={t('signup.company.legalName')}
                icon={<Building2 className="h-4 w-4 text-text-muted" />}
                error={companyForm.formState.errors.name?.message as string | undefined}
                t={t}
              >
                <Input
                  autoFocus
                  placeholder={t('signup.company.legalNamePlaceholder')}
                  {...companyForm.register('name')}
                />
              </Field>

              <Field
                label={t('signup.company.fantasyName')}
                optional
                t={t}
              >
                <Input
                  placeholder={t('signup.company.fantasyNamePlaceholder')}
                  {...companyForm.register('fantasyName')}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('signup.company.document')}
                  icon={<FileText className="h-4 w-4 text-text-muted" />}
                  error={companyForm.formState.errors.document?.message as string | undefined}
                  t={t}
                >
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={formatDocument(companyForm.watch('document'))}
                    onChange={(e) =>
                      companyForm.setValue('document', e.target.value.replace(/\D/g, ''), {
                        shouldValidate: true,
                      })
                    }
                  />
                </Field>

                <Field
                  label={t('signup.company.phone')}
                  icon={<Phone className="h-4 w-4 text-text-muted" />}
                  error={companyForm.formState.errors.primaryPhone?.message as string | undefined}
                  t={t}
                >
                  <Input
                    placeholder="(11) 99999-9999"
                    value={formatPhone(companyForm.watch('primaryPhone'))}
                    onChange={(e) =>
                      companyForm.setValue('primaryPhone', e.target.value.replace(/\D/g, ''), {
                        shouldValidate: true,
                      })
                    }
                  />
                </Field>
              </div>

              <Field
                label={t('signup.company.email')}
                icon={<Mail className="h-4 w-4 text-text-muted" />}
                error={companyForm.formState.errors.email?.message as string | undefined}
                t={t}
              >
                <Input
                  type="email"
                  placeholder="contato@suaempresa.com"
                  {...companyForm.register('email')}
                />
              </Field>

              <Field
                label={t('signup.company.timezone')}
                icon={<Globe className="h-4 w-4 text-text-muted" />}
                optional
                t={t}
              >
                <Input
                  placeholder="America/Sao_Paulo"
                  {...companyForm.register('timezone')}
                />
              </Field>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="flex-1" size="lg">
                  {t('common.next')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submitFinal} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('signup.user.firstName')}
                  error={userForm.formState.errors.firstName?.message as string | undefined}
                  t={t}
                >
                  <Input
                    autoFocus
                    placeholder={t('signup.user.firstNamePlaceholder')}
                    {...userForm.register('firstName')}
                  />
                </Field>
                <Field
                  label={t('signup.user.lastName')}
                  error={userForm.formState.errors.lastName?.message as string | undefined}
                  t={t}
                >
                  <Input
                    placeholder={t('signup.user.lastNamePlaceholder')}
                    {...userForm.register('lastName')}
                  />
                </Field>
              </div>

              <Field
                label={t('signup.user.email')}
                icon={<Mail className="h-4 w-4 text-text-muted" />}
                error={userForm.formState.errors.email?.message as string | undefined}
                t={t}
              >
                <Input
                  type="email"
                  placeholder="voce@suaempresa.com"
                  {...userForm.register('email')}
                />
              </Field>

              <Field
                label={t('signup.user.phone')}
                icon={<Phone className="h-4 w-4 text-text-muted" />}
                optional
                t={t}
              >
                <Input
                  placeholder="(11) 99999-9999"
                  value={formatPhone(userForm.watch('primaryPhone') || '')}
                  onChange={(e) =>
                    userForm.setValue('primaryPhone', e.target.value.replace(/\D/g, ''), {
                      shouldValidate: true,
                    })
                  }
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('signup.user.password')}
                  icon={<Lock className="h-4 w-4 text-text-muted" />}
                  error={userForm.formState.errors.password?.message as string | undefined}
                  t={t}
                >
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...userForm.register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                      aria-label={showPassword ? t('common.hide') : t('common.show')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field
                  label={t('signup.user.passwordConfirm')}
                  icon={<Lock className="h-4 w-4 text-text-muted" />}
                  error={
                    userForm.formState.errors.passwordConfirm?.message as string | undefined
                  }
                  t={t}
                >
                  <div className="relative">
                    <Input
                      type={showPasswordConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...userForm.register('passwordConfirm')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                      aria-label={showPasswordConfirm ? t('common.hide') : t('common.show')}
                    >
                      {showPasswordConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-sm text-text-secondary hover:bg-white/[0.04]">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-white/20 bg-transparent text-brand-500 focus:ring-brand-500"
                  {...userForm.register('acceptTerms')}
                />
                <span>{t('signup.user.termsHtml')}</span>
              </label>
              {userForm.formState.errors.acceptTerms && (
                <p className="text-xs text-red-400 -mt-3">
                  {t(userForm.formState.errors.acceptTerms.message as string)}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  disabled={signup.isPending}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('common.back')}
                </Button>
                <Button type="submit" className="flex-1" size="lg" disabled={signup.isPending}>
                  {signup.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t('signup.user.submit')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                  {t('signup.success.emailSent')}
                </h3>
                <p className="text-sm text-text-secondary">
                  {t('signup.success.checkInbox', { email: userForm.getValues('email') })}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left text-xs text-text-muted">
                <p className="mb-2 font-medium uppercase tracking-wide text-text-secondary">
                  {t('signup.success.nextSteps')}
                </p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>{t('signup.success.step1')}</li>
                  <li>{t('signup.success.step2')}</li>
                  <li>{t('signup.success.step3')}</li>
                </ol>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                {t('signup.success.activateCta')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Little inline helpers ────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2].map((s) => (
        <div key={s} className="flex-1">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all',
              current >= s ? 'bg-brand-500' : 'bg-white/10',
            )}
          />
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  icon,
  optional,
  error,
  children,
  t,
}: {
  label: string;
  icon?: React.ReactNode;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
        {optional && <span className="text-text-muted text-xs">({t('common.optional')})</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-400">{t(error)}</p>}
    </div>
  );
}
