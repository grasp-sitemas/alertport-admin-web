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
import { ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-react';
import { translateDynamicLabel } from '@/lib/i18n-labels';
import { cn } from '@/lib/utils';

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
   * When set, the counter badge uses this value instead of the automatic
   * count. Lets pages that know their own "default" state (e.g. a
   * `status=ACTIVE` isn't really a user filter) report a smarter number.
   */
  activeFilterCount?: number;
  /**
   * Always-expanded variant (legacy pages). Default: collapsible drawer.
   */
  alwaysOpen?: boolean;
  /**
   * Start the drawer open on first render. Default: false.
   */
  defaultOpen?: boolean;
}

/**
 * Count filter values that look "set" to the user. Any non-empty
 * string, non-`__all__`, non-default `status=ACTIVE` counts.
 */
function countActiveFilters(values: Record<string, unknown>): number {
  let count = 0;
  for (const [key, raw] of Object.entries(values)) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw === 'string') {
      if (!raw) continue;
      if (raw === '__all__') continue;
      if (key === 'status' && raw === 'ACTIVE') continue;
      count += 1;
      continue;
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      if (raw) count += 1;
      continue;
    }
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

/**
 * Compact, modern filter panel.
 *
 * Layout decisions:
 *  - Collapsed: single row with a Filter toggle (badge = active count),
 *    a Clear button when filters are set, and an always-visible Search
 *    button on the right. Zero vertical chrome when the user isn't
 *    filtering - keeps the main content area roomy.
 *  - Expanded: a tight grid (3-column on lg, 4 on xl) with small labels
 *    stacked over inputs. Actions pinned to the bottom-right.
 *  - Search does NOT auto-collapse the drawer anymore. Earlier behavior
 *    made live-filter pages look like the click did nothing (the panel
 *    would just slide shut). The operator now stays in context - they
 *    see their filters and the updated results at the same time.
 *  - Button label is "Buscar" (calls onSearch) - was "Filtrar" which
 *    suggested opening a filter drawer, not running the query.
 */
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

  const isOpen = alwaysOpen || open;

  const effectiveCount = useMemo(() => {
    if (typeof activeFilterCount === 'number') return activeFilterCount;
    return countActiveFilters(values);
  }, [activeFilterCount, values]);

  const handleToggle = () => {
    if (alwaysOpen) return;
    setOpen((v) => !v);
  };

  const handleSearch = () => {
    // No auto-collapse - staying open keeps the user in context.
    onSearch();
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-2.5">
      {!alwaysOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={isOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-controls="shared-filter-panel-body"
            className="gap-2 shrink-0"
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
            {isOpen ? (
              <ChevronUp className="h-3.5 w-3.5 opacity-70" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            )}
          </Button>

          {effectiveCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="shrink-0">
              <X className="h-4 w-4" />
              {t('common.clearFilters')}
            </Button>
          )}

          <div className="ml-auto">
            <Button type="button" size="sm" onClick={handleSearch}>
              <Search className="h-4 w-4" />
              {t('common.search')}
            </Button>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          id="shared-filter-panel-body"
          className={cn(
            'flex flex-col gap-3',
            // When the drawer is a child of the collapsible shell, add a
            // thin separator so the fields visually detach from the
            // compact header row above.
            !alwaysOpen && 'pt-1 border-t border-white/[0.05]',
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-2">
            {extras}
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
                  {t(field.labelKey)}
                </label>
                {field.type === 'text' && (
                  <Input
                    value={(values[field.key] as string) || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder || t(field.labelKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
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
          {alwaysOpen && (
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={onClear}>
                <X className="h-4 w-4" />
                {t('common.clearFilters')}
              </Button>
              <Button size="sm" onClick={handleSearch}>
                <Search className="h-4 w-4" />
                {t('common.search')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
