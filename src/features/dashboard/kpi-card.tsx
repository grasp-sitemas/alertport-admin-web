import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  isLoading?: boolean;
}

const accentStyles = {
  brand: { bg: 'bg-brand-600/15', border: 'border-brand-600/30', text: 'text-brand-400', glow: 'shadow-[0_0_60px_rgba(179,38,30,0.08)]' },
  success: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: '' },
  warning: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', glow: '' },
  danger: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', glow: '' },
  info: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', glow: '' },
};

export function KpiCard({ title, value, icon: Icon, trend, accent = 'brand', isLoading }: KpiCardProps) {
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-6 transition-all duration-200 hover:border-white/[0.15]',
        styles.glow,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</p>
          {isLoading ? (
            <div className="mt-3 h-8 w-24 animate-pulse rounded bg-white/5" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-white font-heading tracking-tight">{value}</p>
          )}
          {trend && <p className="mt-1 text-xs text-text-secondary">{trend}</p>}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl border',
            styles.bg,
            styles.border,
          )}
        >
          <Icon className={cn('h-5 w-5', styles.text)} />
        </div>
      </div>
    </div>
  );
}
