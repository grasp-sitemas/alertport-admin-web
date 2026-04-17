'use client';

import { useTranslations } from 'next-intl';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useTrial } from '@/hooks/use-trial';

/**
 * Compact badge shown in the header for any company on a trial plan.
 * Renders nothing when the company is on a legacy / paid plan.
 */
export function TrialBadge() {
  const t = useTranslations();
  const { isTrial, daysRemaining, isReadOnly } = useTrial();

  if (!isTrial) return null;

  if (isReadOnly) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/20"
        aria-label={t('trial.badgeExpiredAria')}
      >
        <AlertTriangle className="h-3 w-3" />
        {t('trial.badgeExpired')}
      </span>
    );
  }

  const days = daysRemaining ?? 0;
  const label =
    days <= 0
      ? t('trial.badgeEndingToday')
      : t('trial.badgeDaysRemaining', { count: days });

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/20"
      aria-label={t('trial.badgeAria', { days })}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  );
}
