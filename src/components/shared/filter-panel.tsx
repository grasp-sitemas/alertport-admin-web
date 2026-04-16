'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
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
}

export function FilterPanel({
  fields,
  values,
  onChange,
  onSearch,
  onClear,
  extras,
}: FilterPanelProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)]">
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
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
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
        <Button size="sm" onClick={onSearch}>
          <Search className="h-4 w-4" />
          {t('common.filter')}
        </Button>
      </div>
    </div>
  );
}
