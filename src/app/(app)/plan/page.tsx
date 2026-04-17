'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, Infinity as InfinityIcon, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { RoleGuard } from '@/components/shared/role-guard';
import { useTrial } from '@/hooks/use-trial';

function formatLimit(limit: number | undefined): string {
  if (limit === undefined || limit === null || limit === -1) return '∞';
  return String(limit);
}

function UsageBar({ used, limit }: { used: number; limit: number | undefined }) {
  if (limit === undefined || limit === null || limit === -1) return null;
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function PlanPage() {
  const t = useTranslations();
  const { context, isTrial, isReadOnly, daysRemaining } = useTrial();

  const planType = context?.planType ?? 'LEGACY';
  const limits = context?.limits ?? {};
  const usage = context?.usage ?? {};
  const features = context?.features ?? {};

  const limitRows: Array<{ key: string; labelKey: string }> = [
    { key: 'users', labelKey: 'plan.limits.users' },
    { key: 'devices', labelKey: 'plan.limits.devices' },
    { key: 'sites', labelKey: 'plan.limits.sites' },
    { key: 'clients', labelKey: 'plan.limits.clients' },
    { key: 'incidents', labelKey: 'plan.limits.incidents' },
    { key: 'integrations', labelKey: 'plan.limits.integrations' },
    { key: 'reportsPerMonth', labelKey: 'plan.limits.reportsPerMonth' },
  ];

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN']}>
      <div className="space-y-6">
        <PageHeader title={t('plan.title')} description={t('plan.subtitle')} />

        {/* Header card: trial state */}
        <section className="rounded-xl border border-white/[0.06] bg-bg-secondary/60 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                {t('plan.currentPlan')}
              </p>
              <h2 className="text-2xl font-semibold text-white">{planType}</h2>
              {isTrial && !isReadOnly && (
                <p className="flex items-center gap-2 text-sm text-amber-300">
                  <Sparkles className="h-4 w-4" />
                  {daysRemaining !== null && daysRemaining > 0
                    ? t('trial.bannerDaysRemaining', { count: daysRemaining })
                    : t('trial.bannerEndingToday')}
                </p>
              )}
              {isReadOnly && (
                <p className="flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  {t('trial.bannerExpiredTitle')}
                </p>
              )}
            </div>
            {context?.trialEndAt && (
              <div className="text-right text-xs text-text-muted">
                <div>{t('plan.trialEnds')}</div>
                <div className="mt-1 text-white">
                  {new Date(context.trialEndAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Limits + usage */}
        <section className="rounded-xl border border-white/[0.06] bg-bg-secondary/60 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t('plan.limitsAndUsage')}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {limitRows.map((row) => {
              const limit = limits[row.key];
              const used = usage[row.key as keyof typeof usage] ?? 0;
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{t(row.labelKey)}</span>
                    <span className="font-mono text-white">
                      {used} /{' '}
                      {limit === -1 || limit === undefined ? (
                        <InfinityIcon className="inline h-3 w-3" />
                      ) : (
                        formatLimit(limit)
                      )}
                    </span>
                  </div>
                  <UsageBar used={used} limit={limit} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Features checklist */}
        <section className="rounded-xl border border-white/[0.06] bg-bg-secondary/60 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">
            {t('plan.features')}
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(features).map(([key, enabled]) => (
              <li
                key={key}
                className={`flex items-center gap-2 text-sm ${
                  enabled ? 'text-white' : 'text-text-muted line-through'
                }`}
              >
                <Check
                  className={`h-4 w-4 ${enabled ? 'text-emerald-400' : 'text-text-muted/40'}`}
                />
                <span className="capitalize">{key.replace(/\./g, ' ')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </RoleGuard>
  );
}
