'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { PasswordChecklist } from '@/features/auth/password-checklist';
import { cn } from '@/lib/utils';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Controlled value so we can feed PasswordChecklist in real time. */
  value: string;
  /** Label displayed above the input. */
  label: string;
  /** When true, renders the live PasswordChecklist below the field. */
  showPolicy?: boolean;
  /** Optional wrapper class */
  wrapperClassName?: string;
  /** Optional i18n-ready error message to display under the field. */
  error?: string;
  /** Optional icon to prefix the input. Defaults to a lock. Pass `null` for none. */
  icon?: React.ReactNode;
}

/**
 * Shared password input used across every signup / change-password / user-form
 * surface in the app. Provides:
 *   - show/hide toggle with an eye icon (modern, a11y-labelled)
 *   - optional live PasswordChecklist honoring the app-wide password policy
 *     (8+ chars, uppercase, special char, no sequential digits)
 *
 * Storage still persists the raw value; the eye toggle only flips the input
 * `type` between "password" and "text".
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { value, label, showPolicy = false, wrapperClassName, error, icon, className, ...rest },
    ref,
  ) {
    const t = useTranslations();
    const [visible, setVisible] = useState(false);
    const prefix =
      icon === null
        ? null
        : (icon ?? <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />);

    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        <Label>{label}</Label>
        <div className="relative">
          {prefix}
          <Input
            ref={ref}
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            spellCheck={false}
            value={value}
            className={cn(prefix ? 'pl-10' : '', 'pr-10', className)}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
            aria-label={visible ? t('common.hide') : t('common.show')}
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {showPolicy && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
              {t('signup.password.rules.title')}
            </p>
            <PasswordChecklist password={value} />
          </div>
        )}
      </div>
    );
  },
);
