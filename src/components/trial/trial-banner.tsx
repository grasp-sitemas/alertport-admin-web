'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useTrial } from '@/hooks/use-trial';
import { useAuth } from '@/hooks/use-auth';
import type { UserSubtype } from '@/types/api';

/**
 * Roles that can act on the plan - the "Ver plano" / upgrade CTA
 * only makes sense to users who can change the billing relationship.
 * OPERATOR and AUDITOR see the banner (so they know the trial is
 * running down) but never the CTA, since they can't act on it and
 * the extra click only adds friction.
 */
const PLAN_ACTION_ROLES: ReadonlySet<UserSubtype> = new Set<UserSubtype>([
  'SUPER_ADMIN_MASTER',
  'ADMIN_MASTER',
  'ADMIN',
]);

/**
 * Full-width banner rendered under the header. Four states:
 *  - hidden (legacy / paid plan)
 *  - info    (trial with more than 3 days left)
 *  - warning (trial ending within 3 days)
 *  - critical (expired / read-only)
 *
 * The primary CTA (Ver plano / Fazer upgrade) is role-gated - non
 * plan-owners see the informational banner without the action.
 */
export function TrialBanner() {
  const t = useTranslations();
  const { isTrial, daysRemaining, isReadOnly } = useTrial();
  const { user } = useAuth();
  const role = user?.companyUser?.subtype as UserSubtype | undefined;
  const canActOnPlan = !!role && PLAN_ACTION_ROLES.has(role);

  if (!isTrial) return null;

  if (isReadOnly) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{t('trial.bannerExpiredTitle')}</span>
          <span className="hidden text-red-300/80 sm:inline">
            - {t('trial.bannerExpiredDescription')}
          </span>
        </div>
        {canActOnPlan && (
          <Link
            href="/plan"
            className="inline-flex items-center gap-1 rounded bg-red-500/20 px-3 py-1 text-xs font-medium text-red-100 transition hover:bg-red-500/30"
          >
            {t('trial.upgradeCta')}
          </Link>
        )}
      </div>
    );
  }

  const days = daysRemaining ?? 0;
  const warning = days <= 3;
  const tone = warning ? 'amber' : 'sky';
  const Icon = warning ? AlertTriangle : Info;

  const toneClasses =
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : 'border-sky-500/30 bg-sky-500/10 text-sky-200';
  const ctaClasses =
    tone === 'amber'
      ? 'bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
      : 'bg-sky-500/20 text-sky-100 hover:bg-sky-500/30';

  const headline =
    days <= 0
      ? t('trial.bannerEndingToday')
      : t('trial.bannerDaysRemaining', { count: days });

  return (
    <div role="status" className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-sm ${toneClasses}`}>
      <div className="flex items-center gap-2">
        {warning ? <Icon className="h-4 w-4 flex-shrink-0" /> : <Sparkles className="h-4 w-4 flex-shrink-0" />}
        <span>{headline}</span>
        <span className="hidden opacity-80 sm:inline">- {t('trial.bannerDescription')}</span>
      </div>
      {canActOnPlan && (
        <Link
          href="/plan"
          className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition ${ctaClasses}`}
        >
          {t('trial.viewPlanCta')}
        </Link>
      )}
    </div>
  );
}
