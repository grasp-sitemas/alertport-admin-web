'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  HierarchyFilters,
  type HierarchyFiltersValue,
} from '@/components/shared/hierarchy-filters';
import { cn } from '@/lib/utils';
import {
  MAX_RANGE_DAYS,
  rangeErrorKey,
  validateReportFilter,
} from './report-filter-validator';

/**
 * Compact filter panel used by every report page.
 *
 * Layout rule: everything - hierarchy (account / client / site),
 * date range, report-specific extras (e.g. SLA threshold), actions -
 * lives in ONE responsive grid so operators get the most vertical
 * space possible for the actual report body. On desktop (lg+) the
 * panel collapses to a single visible row.
 *
 * Density choices:
 *   - 10px uppercase tracking-wider labels (shared with FilterPanel)
 *   - h-9 inputs + selects (vs the default h-10)
 *   - gap-y-2 (vs gap-y-3) and p-3 (vs p-4)
 *   - HierarchyFilters renders with `compact` so its labels and
 *     select heights match.
 */

export interface ReportFilterValue {
  hierarchy: HierarchyFiltersValue;
  startDate: string;
  endDate: string;
}

interface Props {
  value: ReportFilterValue;
  onChange: (next: ReportFilterValue) => void;
  onApply: () => void;
  onClear: () => void;
  /** Optional extra fields (rendered as an extra grid cell, e.g. SLA threshold). */
  extras?: React.ReactNode;
  isLoading?: boolean;
}

const LABEL_CLASS =
  'text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1 block';

export function ReportFilterPanel({
  value,
  onChange,
  onApply,
  onClear,
  extras,
  isLoading,
}: Props) {
  const t = useTranslations();
  const validation = useMemo(
    () =>
      validateReportFilter({
        startDate: value.startDate,
        endDate: value.endDate,
      }),
    [value.startDate, value.endDate],
  );

  const canApply = validation.ok && !isLoading;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
      {/* One dense responsive grid for every filter field. On xl the
          row can hold: account + client + site + start + end + extras
          in six columns. Actions live in their own compact sub-row
          below so they stay discoverable without stealing a grid cell. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-2">
        <HierarchyFilters
          value={value.hierarchy}
          onChange={(hierarchy) => onChange({ ...value, hierarchy })}
          compact
        />

        <div>
          <label htmlFor="report-start-date" className={LABEL_CLASS}>
            {t('common.startDate')}
          </label>
          <Input
            id="report-start-date"
            type="date"
            className="h-9 px-3 text-sm"
            value={value.startDate}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="report-end-date" className={LABEL_CLASS}>
            {t('common.endDate')}
          </label>
          <Input
            id="report-end-date"
            type="date"
            className="h-9 px-3 text-sm"
            value={value.endDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          />
        </div>

        {extras}
      </div>

      {!validation.ok && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-1.5 text-[11px]',
            'border-amber-500/20 bg-amber-500/5 text-amber-200',
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {t(rangeErrorKey(validation.error), {
              max: MAX_RANGE_DAYS,
              actual: validation.rangeDays ?? 0,
            })}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onApply} disabled={!canApply}>
          <Search className="h-4 w-4" />
          {t('common.search')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="h-4 w-4" />
          {t('common.clearFilters')}
        </Button>
        <span className="ml-auto text-[11px] text-text-muted">
          {t('reports.filter.maxRangeHint', { max: MAX_RANGE_DAYS })}
        </span>
      </div>
    </div>
  );
}

/** Exported so report pages can match styling on their own `extras` slot. */
export const REPORT_FILTER_LABEL_CLASS = LABEL_CLASS;
