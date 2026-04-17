'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  MailCheck,
  Lock,
  Phone,
  FileText,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  ShieldCheck,
  Globe,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/layout/logo';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { cn } from '@/lib/utils';
import { signupService } from '@/services/signup.service';
import {
  signupCompanySchema,
  signupUserSchema,
  type SignupCompanyValues,
  type SignupUserValues,
} from '@/features/auth/signup-schemas';
import { COMMON_TIMEZONES, getAllTimezones } from '@/features/auth/timezones';
import { LegalModal, type LegalKind } from '@/features/auth/legal-modal';
import { PasswordChecklist } from '@/features/auth/password-checklist';

type Step = 1 | 2 | 3;

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

// Thin wrapper over the shared mask. Kept for call-site compatibility.
import { maskBrDocument } from '@/lib/br-masks';
import { normalizeBrDocument as normalizeDoc } from '@/lib/br-documents';

function formatDocument(value: string): string {
  return maskBrDocument(value);
}

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3');
  }
  return d.replace(/(\d{2})(\d{5})(\d)/, '($1) $2-$3');
}

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [legalOpen, setLegalOpen] = useState<LegalKind | null>(null);
  const detectedTz = useMemo(detectTimezone, []);
  const allTimezones = useMemo<string[]>(
    () => getAllTimezones(detectedTz),
    [detectedTz],
  );

  const companyForm = useForm<SignupCompanyValues>({
    resolver: zodResolver(signupCompanySchema),
    // Validate on blur so typing CPF/CNPJ doesn't flash an error on every keystroke.
    mode: 'onBlur',
    reValidateMode: 'onBlur',
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

  useEffect(() => {
    // Keep timezone in sync if resolver clears it somehow
    companyForm.setValue('timezone', detectedTz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    onSuccess: () => setStep(3),
    onError: (err: AxiosError<{ code?: string }>) => {
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
    <div className="relative min-h-screen flex flex-col bg-app-gradient overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[640px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <header className="relative z-10 flex items-center justify-end p-6">
        <LocaleSwitcher />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl p-8 sm:p-10 shadow-[0_0_80px_rgba(179,38,30,0.08)]">
            <div className="mb-6 flex justify-center">
              <Logo size="md" showText={false} />
            </div>
            {step !== 3 && <Stepper current={step} />}

            <div className="mt-4 mb-6 text-center sm:text-left">
              <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                {step === 1 && <Building2 className="h-5 w-5 text-brand-500" />}
                {step === 2 && <User className="h-5 w-5 text-brand-500" />}
                {step === 3 && <ShieldCheck className="h-5 w-5 text-emerald-500" />}
                <h1 className="text-2xl font-semibold text-white">
                  {step === 1 && t('signup.company.title')}
                  {step === 2 && t('signup.user.title')}
                  {step === 3 && t('signup.success.title')}
                </h1>
              </div>
              <p className="text-sm text-text-secondary">
                {step === 1 && t('signup.company.subtitle')}
                {step === 2 && t('signup.user.subtitle')}
                {step === 3 && t('signup.success.subtitle')}
              </p>
            </div>

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

                <Field label={t('signup.company.fantasyName')} optional t={t}>
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
                      placeholder="00.000.000/0000-00 ou 00.ABC.000/00DE-00"
                      value={formatDocument(companyForm.watch('document'))}
                      maxLength={18}
                      inputMode="text"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      // Accepts CNPJ Alfanumérico (IN RFB 2.229/2024): digits
                      // and uppercase A-Z in positions 1-12. Anything else is
                      // stripped by `normalizeDoc`. Validation still requires
                      // the last two chars to be digits (handled in the zod
                      // refine / isValidCNPJ).
                      onChange={(e) =>
                        companyForm.setValue('document', normalizeDoc(e.target.value), {
                          shouldValidate: false,
                        })
                      }
                      onBlur={() => companyForm.trigger('document')}
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
                  hint={t('signup.company.timezoneHint')}
                  t={t}
                >
                  <TimezoneSelect
                    value={companyForm.watch('timezone')}
                    onChange={(v) =>
                      companyForm.setValue('timezone', v, { shouldValidate: true })
                    }
                    allTimezones={allTimezones}
                    suggested={COMMON_TIMEZONES}
                    detected={detectedTz}
                  />
                </Field>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => router.push('/login')}
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
                    error={undefined /* surfaced by the checklist below */}
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

                {/* Live password policy checklist */}
                <div className="-mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    {t('signup.password.rules.title')}
                  </p>
                  <PasswordChecklist password={userForm.watch('password') ?? ''} />
                </div>

                <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-sm text-text-secondary hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-white/20 bg-transparent text-brand-500 focus:ring-brand-500"
                    {...userForm.register('acceptTerms')}
                  />
                  <span>
                    {t('signup.user.termsPrefix')}{' '}
                    <button
                      type="button"
                      onClick={() => setLegalOpen('terms')}
                      className="font-medium text-brand-400 underline underline-offset-2 hover:text-brand-300"
                    >
                      {t('legal.terms.link')}
                    </button>{' '}
                    {t('signup.user.termsAnd')}{' '}
                    <button
                      type="button"
                      onClick={() => setLegalOpen('privacy')}
                      className="font-medium text-brand-400 underline underline-offset-2 hover:text-brand-300"
                    >
                      {t('legal.privacy.link')}
                    </button>
                    {t('signup.user.termsSuffix')}
                  </span>
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

            {step === 3 && <SuccessStep email={userForm.getValues('email')} />}
          </div>

          <p className="text-center text-xs text-text-muted mt-6">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-semibold">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </main>

      <LegalModal
        kind="terms"
        open={legalOpen === 'terms'}
        onOpenChange={(o) => setLegalOpen(o ? 'terms' : null)}
        onAccept={() => {
          userForm.setValue('acceptTerms', true as unknown as true, { shouldValidate: true });
        }}
      />
      <LegalModal
        kind="privacy"
        open={legalOpen === 'privacy'}
        onOpenChange={(o) => setLegalOpen(o ? 'privacy' : null)}
        onAccept={() => {
          userForm.setValue('acceptTerms', true as unknown as true, { shouldValidate: true });
        }}
      />
    </div>
  );
}

// ─── Timezone select (searchable via native <datalist>) ─────────────────

interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  allTimezones: string[];
  suggested: string[];
  detected: string;
}

function TimezoneSelect({ value, onChange, allTimezones, suggested, detected }: TimezoneSelectProps) {
  const t = useTranslations();
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          list="signup-tz-options"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="America/Sao_Paulo"
        />
      </div>
      <datalist id="signup-tz-options">
        {allTimezones.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
      {/* Quick-pick chips for common timezones */}
      <div className="flex flex-wrap gap-1.5">
        {[detected, ...suggested.filter((s) => s !== detected)].slice(0, 6).map((tz) => (
          <button
            key={tz}
            type="button"
            onClick={() => onChange(tz)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              value === tz
                ? 'bg-brand-500/20 text-brand-200 ring-1 ring-brand-500/40'
                : 'bg-white/5 text-text-secondary hover:bg-white/10',
            )}
          >
            {tz === detected ? `${tz} · ${t('signup.company.timezoneDetected')}` : tz}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Success step (link-based activation) ──────────────────────────────

function SuccessStep({ email }: { email: string }) {
  const t = useTranslations();
  const router = useRouter();
  const resend = useMutation({
    mutationFn: () => signupService.resend(email),
    onSuccess: () => toast.success(t('signup.activation.resentToast')),
    onError: () => toast.error(t('signup.activation.generic')),
  });

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/30">
        <MailCheck className="h-10 w-10 text-brand-400" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">{t('signup.success.linkSentTitle')}</h3>
        <p className="text-sm text-text-secondary">
          {t('signup.success.linkSentBody')}
        </p>
        <p className="text-sm font-medium text-white break-all">{email}</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left text-xs text-text-muted">
        <p className="mb-2 font-medium uppercase tracking-wider text-text-secondary">
          {t('signup.success.nextStepsTitle')}
        </p>
        <ol className="space-y-1.5 list-decimal list-inside">
          <li>{t('signup.success.linkStep1')}</li>
          <li>{t('signup.success.linkStep2')}</li>
          <li>{t('signup.success.linkStep3')}</li>
        </ol>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
        >
          {resend.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t('signup.success.resendLinkCta')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => router.replace('/login')}
        >
          {t('signup.activation.backToLogin')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-[11px] text-text-muted">{t('signup.success.spamNote')}</p>
    </div>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────────

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
  hint,
  error,
  children,
  t,
}: {
  label: string;
  icon?: React.ReactNode;
  optional?: boolean;
  hint?: string;
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
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && <p className="text-xs text-red-400">{t(error)}</p>}
    </div>
  );
}
