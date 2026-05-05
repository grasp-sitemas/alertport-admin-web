'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Ban, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSessionAccountModules } from '@/features/modules/use-session-account-modules';

interface ModuleGuardProps {
  /** Catalog key of the module this page requires (e.g. "MONITOR"). */
  moduleKey: string;
  children: React.ReactNode;
}

/**
 * Wraps a page so it renders children only when the account has the
 * module enabled (via the /modules SAM screen).
 *
 * Enforcement model:
 *   - SUPER_ADMIN_MASTER bypasses the check entirely - the hook returns
 *     isEnabled=true for SAM, so SAM can always inspect every feature
 *     of every account.
 *   - While the module state is loading, render a Spinner (don't flash
 *     a denial screen on first paint).
 *   - On ERROR, render a "couldn't verify your access" retry UI -
 *     fail-CLOSED. Module flags drive billing / trial / paid features
 *     and a transient 5xx must NOT silently grant access.
 *   - When a module is explicitly disabled, render the friendly notice
 *     with a link back to the dashboard. We deliberately do NOT redirect
 *     - redirecting hides the "why" from the user and confuses history.
 */
export function ModuleGuard({ moduleKey, children }: ModuleGuardProps) {
  const t = useTranslations();
  const modules = useSessionAccountModules();

  if (modules.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (modules.isError) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-300" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-white">{t('modules.errorTitle')}</h1>
          <p className="text-text-secondary text-sm">{t('modules.errorDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => modules.refetch?.()}>
            <RefreshCw className="h-4 w-4" />
            {t('modules.errorRetry')}
          </Button>
          <Link href="/dashboard">
            <Button variant="ghost">{t('modules.disabled.backToDashboard')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (modules.isEnabled(moduleKey)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
        <Ban className="h-6 w-6 text-amber-400" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-white">{t('modules.disabled.title')}</h1>
        <p className="text-text-secondary text-sm">{t('modules.disabled.description')}</p>
      </div>
      <Link href="/dashboard">
        <Button>{t('modules.disabled.backToDashboard')}</Button>
      </Link>
    </div>
  );
}
