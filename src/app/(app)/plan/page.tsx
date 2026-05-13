'use client';
export const dynamic = 'force-dynamic';

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

/**
 * Limit rows displayed under "Limites e uso". Each row has:
 *   - key: identifier we look up in `limits[key]` and `usage[key]`
 *   - labelKey: i18n key under `plan.limits.*`
 *   - trialFallbackLimit: number shown when the backend hasn't yet
 *     emitted this limit (so trial users still see a meaningful quota
 *     until the new fields are wired in `hp-shield-crud`).
 *
 * Rows removed from the legacy list: `incidents`, `integrations`
 * (AlertPort doesn't sell those today). Rows added below give the
 * trial customer a real "test it, like it, subscribe" loop with
 * tight-but-usable quotas.
 */
const LIMIT_ROWS: Array<{ key: string; labelKey: string; trialFallbackLimit?: number }> = [
  { key: 'users', labelKey: 'plan.limits.users', trialFallbackLimit: 5 },
  { key: 'devices', labelKey: 'plan.limits.devices', trialFallbackLimit: 5 },
  { key: 'sites', labelKey: 'plan.limits.sites', trialFallbackLimit: 5 },
  { key: 'clients', labelKey: 'plan.limits.clients', trialFallbackLimit: 5 },
  { key: 'sosAlerts', labelKey: 'plan.limits.sosAlerts', trialFallbackLimit: 50 },
  { key: 'attendances', labelKey: 'plan.limits.attendances', trialFallbackLimit: 100 },
  { key: 'alertSchedules', labelKey: 'plan.limits.alertSchedules', trialFallbackLimit: 30 },
  { key: 'recordings', labelKey: 'plan.limits.recordings', trialFallbackLimit: 20 },
  { key: 'reportsPerMonth', labelKey: 'plan.limits.reportsPerMonth', trialFallbackLimit: 30 },
];

/**
 * Features displayed under "Recursos incluídos". Renders in this order
 * regardless of the keys returned by the backend. We hide `chat`,
 * `incidents`, `integrations` (no longer in the AlertPort scope) and
 * surface the new realtime SOS / scheduling / recording capabilities.
 *
 * `enabledFallback` applies when the backend hasn't yet emitted the
 * key. New AlertPort-native features default to enabled so trial
 * users see the actual product, not a "coming soon" list.
 */
const FEATURES_ORDER: Array<{ key: string; enabledFallback: boolean }> = [
  { key: 'monitor.realtime', enabledFallback: true },
  { key: 'sos', enabledFallback: true },
  { key: 'attendance', enabledFallback: true },
  { key: 'alertSchedules', enabledFallback: true },
  { key: 'recordings', enabledFallback: true },
  { key: 'reports.export', enabledFallback: true },
  { key: 'analytics.advanced', enabledFallback: false },
];

const HIDDEN_FEATURE_KEYS = new Set(['chat', 'incidents', 'integrations']);

export default function PlanPage() {
  const t = useTranslations();
  const { context, isTrial, isReadOnly, daysRemaining } = useTrial();

  const planType = context?.planType ?? 'LEGACY';
  const limits = context?.limits ?? {};
  const usage = context?.usage ?? {};
  const features = context?.features ?? {};

  return (
    <RoleGuard roles={['SUPER_ADMIN_MASTER', 'ADMIN_MASTER', 'ADMIN']}>
      <div className="space-y-6">
        <PageHeader title={t('plan.title')} description={t('plan.subtitle')} />

        {/* Header card: trial state */}
        <section className="bg-bg-secondary/60 rounded-xl border border-white/[0.06] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-text-muted text-xs tracking-wide uppercase">
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
              <div className="text-text-muted text-right text-xs">
                <div>{t('plan.trialEnds')}</div>
                <div className="mt-1 text-white">
                  {new Date(context.trialEndAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Limits + usage */}
        <section className="bg-bg-secondary/60 rounded-xl border border-white/[0.06] p-6">
          <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wide uppercase">
            {t('plan.limitsAndUsage')}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LIMIT_ROWS.map((row) => {
              // Backend value wins; otherwise fall back to a trial-tuned
              // default so the column never shows `0 / ∞` (which would
              // hide the quota cue we want trial users to feel).
              const fromBackend = limits[row.key];
              const limit =
                fromBackend !== undefined
                  ? fromBackend
                  : isTrial
                    ? row.trialFallbackLimit
                    : undefined;
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
        <section className="bg-bg-secondary/60 rounded-xl border border-white/[0.06] p-6">
          <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wide uppercase">
            {t('plan.features')}
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FEATURES_ORDER.filter((f) => !HIDDEN_FEATURE_KEYS.has(f.key)).map(
              ({ key, enabledFallback }) => {
                const fromBackend = features[key];
                const enabled = fromBackend === undefined ? enabledFallback : Boolean(fromBackend);
                // Backend emits keys like "users", "reports.export",
                // "monitor.realtime". Map dots to underscores so they can
                // live in the `plan.featuresList` namespace without
                // breaking intl's nested-key lookup. Fall back to a
                // humanized version if the translation is missing.
                const translationKey = `plan.featuresList.${key.replace(/\./g, '_')}`;
                const humanFallback = key
                  .split('.')
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(' ');
                return (
                  <li
                    key={key}
                    className={`flex items-center gap-2 text-sm ${
                      enabled ? 'text-white' : 'text-text-muted line-through'
                    }`}
                  >
                    <Check
                      className={`h-4 w-4 ${enabled ? 'text-emerald-400' : 'text-text-muted/40'}`}
                    />
                    <span>{t.has(translationKey) ? t(translationKey) : humanFallback}</span>
                  </li>
                );
              },
            )}
          </ul>
        </section>
      </div>
    </RoleGuard>
  );
}
