'use client';

/**
 * Global banner that surfaces backend-wide unavailability.
 *
 * The axios client tracks consecutive 5xx/network failures and
 * broadcasts `service:unavailable` when it crosses the threshold
 * (currently 2 in a row). Once a successful response comes back, it
 * emits `service:restored` and we hide the banner.
 *
 * Why this exists: when ms-report (or any Heroku dyno) drops, pages
 * today spin forever and users have no idea the platform is down -
 * they blame their internet, call support, and no one knows where
 * the real problem is. A single persistent banner fixes that without
 * needing per-page error UX.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';

export function ServiceHealthBanner() {
  const t = useTranslations();
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const up = () => setIsUnavailable(false);
    const down = () => setIsUnavailable(true);
    window.addEventListener('service:unavailable', down);
    window.addEventListener('service:restored', up);
    return () => {
      window.removeEventListener('service:unavailable', down);
      window.removeEventListener('service:restored', up);
    };
  }, []);

  if (!isUnavailable) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span className="font-medium">
        {t('serviceHealth.unavailableTitle')}
      </span>
      <span className="hidden opacity-80 sm:inline">
        - {t('serviceHealth.unavailableDescription')}
      </span>
    </div>
  );
}
