'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Circle, ShieldCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MONITOR_TAGS, type MonitorTag } from './monitor-filter';

interface MonitorFilterTagsProps {
  /** Currently active tag, or '' when none is selected. */
  value: MonitorTag | '';
  /** Toggle handler. Clicking the active tag should clear it (pass ''). */
  onChange: (value: MonitorTag | '') => void;
}

const TAG_META: Record<MonitorTag, { labelKey: string; icon: LucideIcon }> = {
  SOS: { labelKey: 'alerts.tagSos', icon: AlertTriangle },
  AVAILABLE: { labelKey: 'alerts.tagAvailable', icon: Circle },
  IN_PROGRESS: { labelKey: 'alerts.tagInProgress', icon: ShieldCheck },
};

/**
 * Clickable quick-filter tags above the monitor list. Replaces the legacy
 * Categoria dropdown. Single-select: clicking the active tag clears the
 * filter. Styling uses design tokens only (no hardcoded colors).
 */
export function MonitorFilterTags({ value, onChange }: MonitorFilterTagsProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('alerts.category')}>
      {MONITOR_TAGS.map((tag) => {
        const meta = TAG_META[tag];
        const Icon = meta.icon;
        const isActive = value === tag;
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(isActive ? '' : tag)}
            className={cn(
              'focus-visible:ring-brand-500/40 focus-visible:ring-offset-background inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
              isActive
                ? 'border-brand-500/40 bg-brand-600/20 text-brand-300'
                : 'text-text-secondary border-white/10 bg-white/5 hover:bg-white/10 hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t(meta.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
