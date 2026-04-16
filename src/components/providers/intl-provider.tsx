'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { defaultLocale, type Locale, locales } from '@/config/i18n';
import { getStoredLocale } from '@/hooks/use-locale';

import ptMessages from '@/messages/pt.json';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import jaMessages from '@/messages/ja.json';
import zhMessages from '@/messages/zh.json';

const messagesMap: Record<Locale, Record<string, unknown>> = {
  pt: ptMessages,
  en: enMessages,
  es: esMessages,
  ja: jaMessages,
  zh: zhMessages,
};

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): Locale {
  const stored = getStoredLocale();
  return locales.includes(stored) ? stored : defaultLocale;
}

function getServerSnapshot(): Locale {
  return defaultLocale;
}

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messagesMap[locale]}
      // Be tolerant with dynamic keys that come from backend (str.helpers.*):
      // return the key itself as fallback instead of throwing.
      onError={() => {}}
      getMessageFallback={({ key, namespace }) =>
        namespace ? `${namespace}.${key}` : key
      }
    >
      {children}
    </NextIntlClientProvider>
  );
}
