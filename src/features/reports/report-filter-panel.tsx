'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
 * Unified filter panel for every report page.
 *
 * Encapsulates:
 *  - Hierarchy picker (account / client / site)
 *  - Date range (startDate / endDate) with inline validation
 *  - 30-day max enforcement (matches the backend hard cap in
 *    `alertport-report-helpers.js::parseFilter`)
 *  - Search / Clear buttons
 *
 * Keeping this in one place means every report shares the same
 * validation, layout, and language — critical for the
 * "profissional, muito bem distribuído" bar.
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
  /** Optional extra fields rendered to the right of dates (e.g. SLA threshold). */
  extras?: React.ReactNode;
  isLoading?: boolean;
}

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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
      <HierarchyFilters
        value={value.hierarchy}
        onChange={(hierarchy) => onChange({ ...value, hierarchy })}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-start-date">{t('common.startDate')}</Label>
          <Input
            id="report-start-date"
            type="date"
            value={value.startDate}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-end-date">{t('common.endDate')}</Label>
          <Input
            id="report-end-date"
            type="date"
            value={value.endDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          />
        </div>
        {extras}
      </div>

      {!validation.ok && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-xl border px-3 py-2 text-xs',
            'border-amber-500/20 bg-amber-500/5 text-amber-200',
          )}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            {t(rangeErrorKey(validation.error), {
              max: MAX_RANGE_DAYS,
              actual: validation.rangeDays ?? 0,
            })}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" onClick={onApply} disabled={!canApply}>
          <Search className="h-4 w-4" />
          {t('common.search')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="h-4 w-4" />
          {t('common.clearFilters')}
        </Button>
        <span className="ml-auto text-xs text-text-muted">
          {t('reports.filter.maxRangeHint', { max: MAX_RANGE_DAYS })}
        </span>
      </div>
    </div>
  );
}
