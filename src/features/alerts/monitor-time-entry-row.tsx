'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, LogIn, LogOut, Coffee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TimeEntry, TimeEntryType } from '@/types/api';

const TYPE_META: Record<
  TimeEntryType,
  { labelKey: string; icon: typeof Clock; accent: 'success' | 'info' | 'warning' | 'muted' }
> = {
  CLOCK_IN: { labelKey: 'attendance.clockIn', icon: LogIn, accent: 'success' },
  CLOCK_OUT: { labelKey: 'attendance.clockOut', icon: LogOut, accent: 'info' },
  BREAK_START: { labelKey: 'attendance.breakStart', icon: Coffee, accent: 'warning' },
  BREAK_END: { labelKey: 'attendance.breakEnd', icon: Coffee, accent: 'muted' },
};

interface Props {
  entry: TimeEntry;
  flash?: boolean;
}

/**
 * Memoized row for a single time-entry. Kept intentionally lean: the
 * monitor can easily show 50+ entries and re-rendering the whole list on
 * every KPI tick is expensive.
 */
function MonitorTimeEntryRowImpl({ entry, flash }: Props) {
  const t = useTranslations();
  const meta = TYPE_META[entry.eventType] ?? TYPE_META.CLOCK_IN;
  const Icon = meta.icon;
  const when = entry.createdAt || entry.createdDate || entry.timestamp;
  const userName =
    (entry.user && `${entry.user.firstName ?? ''} ${entry.user.lastName ?? ''}`.trim()) || '';
  const siteName =
    entry.site && typeof entry.site === 'object' ? entry.site.name : '';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 transition-all',
        flash && 'border-brand-500/50 bg-brand-500/[0.06] animate-pulse',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          meta.accent === 'success' && 'bg-emerald-500/20 text-emerald-400',
          meta.accent === 'info' && 'bg-blue-500/20 text-blue-400',
          meta.accent === 'warning' && 'bg-amber-500/20 text-amber-400',
          meta.accent === 'muted' && 'bg-white/10 text-text-muted',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={meta.accent}>{t(meta.labelKey)}</Badge>
          {userName && <span className="text-sm text-white truncate">{userName}</span>}
        </div>
        <p className="text-xs text-text-muted mt-0.5 truncate">
          {when && new Date(when).toLocaleString()}
          {siteName && ` · ${siteName}`}
        </p>
      </div>
    </div>
  );
}

export const MonitorTimeEntryRow = memo(MonitorTimeEntryRowImpl);
