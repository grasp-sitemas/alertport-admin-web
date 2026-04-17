'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { evaluatePassword } from './password-policy';
import { cn } from '@/lib/utils';

interface PasswordChecklistProps {
  password: string;
}

/**
 * Live, compact password-policy checklist. Each rule shows a ✓ when passed and
 * a subtle ○ when not yet. Colors: emerald-400 (passed), text-muted (pending),
 * rose-400 briefly if the user actively broke the rule (value present + fail).
 */
export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const t = useTranslations();
  const rules = evaluatePassword(password);
  const touched = (password ?? '').length > 0;

  return (
    <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2" aria-live="polite">
      {rules.map((rule) => {
        const failedAndTouched = touched && !rule.passed;
        return (
          <li
            key={rule.key}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              rule.passed
                ? 'text-emerald-400'
                : failedAndTouched
                  ? 'text-rose-400'
                  : 'text-text-muted',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ring-1',
                rule.passed
                  ? 'bg-emerald-500/15 ring-emerald-500/40'
                  : failedAndTouched
                    ? 'bg-rose-500/10 ring-rose-500/30'
                    : 'bg-white/[0.04] ring-white/10',
              )}
            >
              {rule.passed ? (
                <Check className="h-2.5 w-2.5" />
              ) : failedAndTouched ? (
                <X className="h-2.5 w-2.5" />
              ) : null}
            </span>
            <span>{t(rule.labelKey)}</span>
          </li>
        );
      })}
    </ul>
  );
}
