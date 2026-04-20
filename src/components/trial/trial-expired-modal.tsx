'use client';

/**
 * Blocking modal shown when the trial has expired mid-session.
 *
 * Without this, the trial lock is silent: buttons gray out but the app
 * stays navigable, the operator keeps clicking and sees toasts without
 * understanding why nothing saves. The modal makes the state loud and
 * offers the one action that matters (upgrade) to plan owners while
 * still letting non-admins log out to avoid wasting their shift.
 *
 * Rules:
 *  - Only appears AFTER the TrialProvider has fetched its first
 *    context (so we don't flash it during the initial hydration).
 *  - `isReadOnly` coming from the backend is the source of truth.
 *  - Only ADMIN / ADMIN_MASTER / SUPER_ADMIN_MASTER see the upgrade
 *    link (matches the TrialBanner role gate).
 *  - Can't be dismissed - the trial is expired, not a warning.
 */

import Link from 'next/link';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTrial } from '@/hooks/use-trial';
import { useAuth } from '@/hooks/use-auth';
import type { UserSubtype } from '@/types/api';

const PLAN_ACTION_ROLES: ReadonlySet<UserSubtype> = new Set<UserSubtype>([
  'SUPER_ADMIN_MASTER',
  'ADMIN_MASTER',
  'ADMIN',
]);

export function TrialExpiredModal() {
  const t = useTranslations();
  const { isReady, isReadOnly } = useTrial();
  const { user, logout } = useAuth();
  const role = user?.companyUser?.subtype as UserSubtype | undefined;
  const canActOnPlan = !!role && PLAN_ACTION_ROLES.has(role);

  // Gate: only show when trial provider has resolved and the account
  // is actually locked. Pre-hydration, or for non-trial customers,
  // render nothing.
  if (!isReady) return null;
  if (!isReadOnly) return null;
  if (!user) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="max-w-md w-[calc(100%-2rem)] rounded-2xl border border-red-500/30 bg-bg-secondary shadow-2xl shadow-red-900/30 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="trial-expired-title" className="text-lg font-semibold text-white">
              {t('trial.expiredModalTitle')}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {t('trial.expiredModalDescription')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 hover:bg-white/5 px-3 py-2 text-sm text-text-secondary transition"
          >
            <LogOut className="h-4 w-4" />
            {t('trial.expiredModalLogout')}
          </button>
          {canActOnPlan && (
            <Link
              href="/plan"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white transition"
            >
              {t('trial.expiredModalUpgrade')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
