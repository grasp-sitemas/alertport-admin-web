export const locales = ['pt', 'en', 'es', 'ja', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt';

export const localeNames: Record<Locale, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
  ja: '日本語',
  zh: '中文',
};

export const localeFlags: Record<Locale, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
};

export function getLocaleFromBrowser(): Locale {
  if (typeof navigator === 'undefined') return defaultLocale;
  const lang = navigator.language?.toLowerCase() || '';
  if (lang.startsWith('pt')) return 'pt';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('zh')) return 'zh';
  return defaultLocale;
}
