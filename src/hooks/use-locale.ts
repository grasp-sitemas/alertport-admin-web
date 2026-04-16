'use client';

import { useSyncExternalStore } from 'react';
import { defaultLocale, type Locale, locales } from '@/config/i18n';

const LOCALE_STORAGE_KEY = 'alertport_locale';

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && locales.includes(stored as Locale)) {
      return stored as Locale;
    }
  } catch {
    // ignore
  }
  return defaultLocale;
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const locale = useSyncExternalStore(
    subscribe,
    () => getStoredLocale(),
    () => defaultLocale,
  );

  const setLocale = (newLocale: Locale) => {
    setStoredLocale(newLocale);
    // Trigger reload to re-bootstrap the IntlProvider with the new locale.
    // This preserves consistency across the tree and avoids partial retranslation.
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return [locale, setLocale];
}
