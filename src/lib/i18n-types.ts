/**
 * Shared function signature for the `t` callable returned by
 * next-intl's `useTranslations()`. Typing this explicitly lets us
 * pass translators into plain-object helpers (config builders,
 * validators) without pulling the full next-intl type namespace.
 */
export type TranslateFn = (key: string, values?: Record<string, string | number>) => string;
