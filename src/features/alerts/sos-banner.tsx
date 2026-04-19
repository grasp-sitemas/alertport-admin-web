'use client';

/**
 * Persistent stacked banner shown on top of every authenticated page
 * when an SOS alert is pending. Design goals:
 *
 *   • Unmissable (red, top-center, high z-index, attention shadow).
 *   • One-click claim — primary CTA is "Atender agora" which deep-
 *     links the operator to the monitor with the event pre-claimed.
 *   • Non-blocking — the rest of the UI remains interactive so the
 *     operator can finish whatever action they were on before pivoting.
 *   • Stackable — up to 3 SOS visible, rest collapse to "+N".
 *   • Keyboard-accessible — Esc dismisses the focused banner;
 *     Enter/Space claims.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, BellRing, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSosNotifications, type SosNotification } from './sos-notification-context';

const VISIBLE_MAX = 3;

export function SosBanner() {
  const t = useTranslations();
  const {
    notifications,
    acknowledge,
    claim,
    canRequestBrowserPermission,
    requestBrowserPermission,
  } = useSosNotifications();

  // Prompt for browser permission only once an SOS is actually pending
  // (spares fresh-login permission fatigue).
  useEffect(() => {
    if (!canRequestBrowserPermission) return;
    if (!notifications.length) return;
  }, [canRequestBrowserPermission, notifications.length]);

  if (!notifications.length) return null;

  const visible = notifications.slice(0, VISIBLE_MAX);
  const overflow = notifications.length - visible.length;

  return (
    <div
      className="fixed inset-x-0 top-2 z-[80] flex flex-col items-center gap-2 px-2 sm:top-4 pointer-events-none"
      aria-live="assertive"
      role="alert"
    >
      {visible.map((n) => (
        <SosBannerCard
          key={n.id}
          notification={n}
          onClaim={claim}
          onDismiss={acknowledge}
        />
      ))}
      {overflow > 0 && (
        <div className="pointer-events-auto rounded-full bg-red-500/90 px-3 py-1 text-xs text-white shadow-lg">
          +{overflow} {t('alerts.sosBanner.more')}
        </div>
      )}
      {canRequestBrowserPermission && (
        <button
          type="button"
          onClick={() => void requestBrowserPermission()}
          className="pointer-events-auto rounded-full border border-white/20 bg-bg-primary/90 px-3 py-1 text-xs text-text-secondary backdrop-blur hover:text-white"
        >
          <BellRing className="inline h-3 w-3 mr-1" />
          {t('alerts.sosBanner.enableDesktopAlerts')}
        </button>
      )}
    </div>
  );
}

function SosBannerCard({
  notification,
  onClaim,
  onDismiss,
}: {
  notification: SosNotification;
  onClaim: (n: SosNotification) => void;
  onDismiss: (id: string) => void;
}) {
  const t = useTranslations();
  const when = notification.date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-xl rounded-2xl border border-red-500/50 bg-red-950/85 text-white shadow-2xl shadow-red-900/40 backdrop-blur',
        'animate-[fadeIn_150ms_ease-out]',
      )}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onDismiss(notification.id);
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          onClaim(notification);
        }
      }}
      tabIndex={0}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/25">
          <span className="absolute inline-flex h-full w-full rounded-xl bg-red-500/30 animate-ping" />
          <AlertTriangle className="relative h-5 w-5 text-red-300" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="truncate">
              {notification.type === 'SOS_ALERT'
                ? t('alerts.sosAlert')
                : notification.type}
            </span>
            <span className="text-xs font-normal text-red-200/80">· {when}</span>
          </div>
          <p className="truncate text-xs text-red-100/80">
            {t('alerts.sosBanner.description')}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="bg-white text-red-900 hover:bg-red-50"
            onClick={() => onClaim(notification)}
          >
            {t('alerts.sosBanner.claim')}
          </Button>
          <button
            type="button"
            aria-label={t('alerts.sosBanner.dismiss')}
            onClick={() => onDismiss(notification.id)}
            className="rounded-lg p-1.5 text-red-100/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
