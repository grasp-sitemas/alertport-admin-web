'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Ban } from 'lucide-react';
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
 *   - While the module state is loading or errored, the hook is fail-open
 *     (isEnabled returns true). This avoids locking the operator out
 *     during a network blip and matches the sidebar behaviour.
 *   - When a module is explicitly disabled, a friendly notice is shown
 *     with a link back to the dashboard. We deliberately do NOT redirect
 *     - redirecting makes the browser history confusing and hides the
 *     "why" from the user.
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

  if (modules.isEnabled(moduleKey)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
        <Ban className="h-6 w-6 text-amber-400" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-white">
          {t('modules.disabled.title')}
        </h1>
        <p className="text-sm text-text-secondary">
          {t('modules.disabled.description')}
        </p>
      </div>
      <Link href="/dashboard">
        <Button>{t('modules.disabled.backToDashboard')}</Button>
      </Link>
    </div>
  );
}
