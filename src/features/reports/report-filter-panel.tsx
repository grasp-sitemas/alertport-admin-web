'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HierarchyFilters,
  type HierarchyFiltersValue,
} from '@/components/shared/hierarchy-filters';
import { useEquipmentsBySiteLookup } from '@/features/shared/use-hierarchy-lookups';
import { cn } from '@/lib/utils';
import { MAX_RANGE_DAYS, rangeErrorKey, validateReportFilter } from './report-filter-validator';

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
  /**
   * Optional device (equipment) filter. Only enabled once a site is
   * picked - mirrors the cascading hierarchy behaviour. Backend
   * silently ignores it for reports that don't index by equipment;
   * for device-event reports it scopes to a single device.
   */
  equipment?: string;
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

export function ReportFilterPanel({ value, onChange, onApply, onClear, extras, isLoading }: Props) {
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

  // Device lookup (RP3): only fires once a site is picked. Hook is
  // cascading-aware - it auto-clears when site changes upstream.
  const equipmentsLookup = useEquipmentsBySiteLookup({
    account: value.hierarchy.account || undefined,
    client: value.hierarchy.client || undefined,
    site: value.hierarchy.site || undefined,
  });

  // When site changes (or is cleared), wipe any equipment selection so
  // the filter never sends a device id that doesn't belong to the new
  // hierarchy. Same pattern HierarchyFilters uses for client → site.
  useEffect(() => {
    if (!value.hierarchy.site && value.equipment) {
      onChange({ ...value, equipment: undefined });
    }
  }, [value.hierarchy.site, value.equipment, value, onChange]);

  const equipmentOptions = equipmentsLookup.data?.results ?? [];
  const equipmentDisabled = !value.hierarchy.site || equipmentsLookup.isLoading;

  return (
    <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      {/* One dense responsive grid for every filter field. On xl the
          row can hold: account + client + site + start + end + extras
          in six columns. Actions live in their own compact sub-row
          below so they stay discoverable without stealing a grid cell. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        <HierarchyFilters
          value={value.hierarchy}
          onChange={(hierarchy) =>
            onChange({
              ...value,
              hierarchy,
              // Picking a new site/client/account invalidates the previously
              // chosen device — drop it so the next request is clean.
              equipment: undefined,
            })
          }
          compact
        />

        <div>
          <label className={LABEL_CLASS}>{t('reports.filters.device')}</label>
          <Select
            value={value.equipment || '__all__'}
            onValueChange={(val) => {
              const equipment = val === '__all__' ? undefined : val;
              onChange({ ...value, equipment });
            }}
            disabled={equipmentDisabled}
          >
            <SelectTrigger className="h-9 px-3 text-sm">
              <SelectValue placeholder={t('common.selectOption')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('common.all')}</SelectItem>
              {equipmentOptions.map((eq) => {
                const label = eq.code || eq.name || eq._id;
                return (
                  <SelectItem key={eq._id} value={eq._id}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

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
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
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
        <span className="text-text-muted ml-auto text-[11px]">
          {t('reports.filter.maxRangeHint', { max: MAX_RANGE_DAYS })}
        </span>
      </div>
    </div>
  );
}

/** Exported so report pages can match styling on their own `extras` slot. */
export const REPORT_FILTER_LABEL_CLASS = LABEL_CLASS;
