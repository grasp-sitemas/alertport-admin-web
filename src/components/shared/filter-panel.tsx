'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, Search, X } from 'lucide-react';
import { translateDynamicLabel } from '@/lib/i18n-labels';

interface FilterField {
  key: string;
  labelKey: string;
  type: 'text' | 'select' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface FilterPanelProps {
  fields: FilterField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onSearch: () => void;
  onClear: () => void;
  /**
   * Optional extra filter controls rendered inside the grid, before the
   * declarative `fields`. Use this slot for components that can't be
   * modeled as a simple field (cascading hierarchy, etc.).
   */
  extras?: React.ReactNode;
  /**
   * When set, the counter badge on the toggle button uses this value
   * instead of the automatic count. Lets pages that know their own
   * "default" state (e.g. `status=ACTIVE` doesn't really count as a
   * user filter) report a smarter number.
   */
  activeFilterCount?: number;
  /**
   * When true, renders the panel in the legacy "always expanded" layout
   * instead of the collapsible drawer. Intended as a temporary escape
   * hatch for pages that render outside a scroll container and look odd
   * with a drawer. Default is `false` — collapsed by default.
   */
  alwaysOpen?: boolean;
  /**
   * When true the drawer starts open on first render. Useful for pages
   * where the filters are the primary interaction. Default is `false`.
   */
  defaultOpen?: boolean;
}

/**
 * Count filter values that look "set" to the user. Heuristic: any
 * non-empty string, non-`__all__`, non-default status. Booleans and
 * numbers count as "set" when truthy. This is good enough for a UI
 * badge — a page that needs finer control passes `activeFilterCount`.
 */
function countActiveFilters(values: Record<string, unknown>): number {
  let count = 0;
  for (const [key, raw] of Object.entries(values)) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'string') {
      if (!raw) continue;
      if (raw === '__all__') continue;
      // Treat the ubiquitous `status: 'ACTIVE'` default as "not filtering"
      // so a fresh page load shows 0 on the badge.
      if (key === 'status' && raw === 'ACTIVE') continue;
      count += 1;
      continue;
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      if (raw) count += 1;
      continue;
    }
    // Arrays and objects (e.g. hierarchy sub-filters) — count as set if
    // at least one nested value is truthy.
    if (Array.isArray(raw)) {
      if (raw.length > 0) count += 1;
      continue;
    }
    if (typeof raw === 'object') {
      if (Object.values(raw as Record<string, unknown>).some(Boolean)) count += 1;
      continue;
    }
  }
  return count;
}

export function FilterPanel({
  fields,
  values,
  onChange,
  onSearch,
  onClear,
  extras,
  activeFilterCount,
  alwaysOpen = false,
  defaultOpen = false,
}: FilterPanelProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(alwaysOpen || defaultOpen);

  // Lock `open` to `true` when the caller forces `alwaysOpen` — don't
  // fight the state of a controlled variant.
  const isOpen = alwaysOpen || open;

  const effectiveCount = useMemo(() => {
    if (typeof activeFilterCount === 'number') return activeFilterCount;
    return countActiveFilters(values);
  }, [activeFilterCount, values]);

  const handleToggle = () => {
    if (alwaysOpen) return;
    setOpen((v) => !v);
  };

  const handleSearchAndCollapse = () => {
    onSearch();
    // Collapse the drawer after submitting filters so the results are
    // immediately visible. The operator can always reopen to tweak.
    if (!alwaysOpen) setOpen(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-3">
      {!alwaysOpen && (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant={isOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-controls="shared-filter-panel-body"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {t('common.filters')}
            {effectiveCount > 0 && (
              <span
                aria-label={`${effectiveCount} ${t('common.filters').toLowerCase()}`}
                className="inline-flex items-center justify-center rounded-full bg-brand-600/30 text-brand-300 text-[10px] font-bold h-4 min-w-[1rem] px-1"
              >
                {effectiveCount}
              </span>
            )}
          </Button>
          {effectiveCount > 0 && !isOpen && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4" />
              {t('common.clearFilters')}
            </Button>
          )}
        </div>
      )}

      {isOpen && (
        <div
          id="shared-filter-panel-body"
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {extras}
            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                  {t(field.labelKey)}
                </label>
                {field.type === 'text' && (
                  <Input
                    value={(values[field.key] as string) || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder || t(field.labelKey)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAndCollapse()}
                  />
                )}
                {field.type === 'select' && (
                  <Select
                    value={(values[field.key] as string) || '__all__'}
                    onValueChange={(val) => onChange(field.key, val === '__all__' ? '' : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.selectOption')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t('common.all')}</SelectItem>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {translateDynamicLabel(opt.label, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.type === 'date' && (
                  <Input
                    type="date"
                    value={(values[field.key] as string) || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4" />
              {t('common.clearFilters')}
            </Button>
            <Button size="sm" onClick={handleSearchAndCollapse}>
              <Search className="h-4 w-4" />
              {t('common.filter')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
