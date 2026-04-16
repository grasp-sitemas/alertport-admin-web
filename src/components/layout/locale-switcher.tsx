'use client';

import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locales, localeNames, localeFlags, type Locale } from '@/config/i18n';
import { useLocale } from '@/hooks/use-locale';

export function LocaleSwitcher() {
  const [currentLocale, setLocale] = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change language">
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => setLocale(locale as Locale)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{localeFlags[locale]}</span>
              <span>{localeNames[locale]}</span>
            </span>
            {currentLocale === locale && <Check className="h-4 w-4 text-brand-500" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
