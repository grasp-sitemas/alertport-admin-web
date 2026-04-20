'use client';

import { memo, type ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Premium KPI tile used across the reports module. Accent colors
 * map to the meaning: `success` for positive KPIs (adherence %,
 * compliance), `danger` for bad (missed count), `warning` for
 * mid-tier (in progress, expired), `info/brand` for neutral counts.
 */
export interface ReportKpiTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ComponentType<LucideProps>;
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const ACCENT_BG: Record<NonNullable<ReportKpiTileProps['accent']>, string> = {
  brand: 'bg-brand-600/20 text-brand-300',
  success: 'bg-emerald-500/20 text-emerald-300',
  warning: 'bg-amber-500/20 text-amber-300',
  danger: 'bg-red-500/20 text-red-300',
  info: 'bg-sky-500/20 text-sky-300',
};

const ACCENT_TEXT: Record<NonNullable<ReportKpiTileProps['accent']>, string> = {
  brand: 'text-brand-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-red-300',
  info: 'text-sky-300',
};

function ReportKpiTileImpl({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'brand',
  className,
}: ReportKpiTileProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4',
        className,
      )}
    >
      {Icon && (
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ACCENT_BG[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-muted truncate">{label}</p>
        <p className={cn('text-2xl font-semibold mt-0.5', ACCENT_TEXT[accent])}>
          {value}
        </p>
        {hint && <p className="text-[11px] text-text-muted/80 mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  );
}

export const ReportKpiTile = memo(ReportKpiTileImpl);

interface GridProps {
  children: React.ReactNode;
  /** Number of tiles per row on lg+ screens. */
  cols?: 2 | 3 | 4 | 5;
}

export function ReportKpiGrid({ children, cols = 4 }: GridProps) {
  const lgCols = {
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
  }[cols];
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3', lgCols)}>{children}</div>;
}

/**
 * Helpers for summary formatting - used by every report page so
 * numbers render consistently.
 */
export function formatPercent(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '-';
  return `${n.toFixed(1)}%`;
}

export function formatSeconds(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '-';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function formatNumber(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '-';
  return n.toLocaleString();
}
