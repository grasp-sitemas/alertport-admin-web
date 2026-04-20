import { toast } from 'sonner';
import type { FieldErrors } from 'react-hook-form';

/**
 * Build an `onInvalid` handler for react-hook-form's `handleSubmit` that
 * surfaces the first validation message as a toast. Without this, a failed
 * zod validation silently drops the submit - the user clicks Save and
 * nothing happens because the invalid field is off-screen or its inline
 * `<p class="text-red-400">` error is hidden inside a collapsed section.
 */
export function toastFirstError<T extends Record<string, unknown>>(
  translate: (key: string) => string,
) {
  return (errors: FieldErrors<T>) => {
    const message = findFirstMessage(errors);
    const fallback = translate('notifications.validationFailed');
    toast.error(fallback, {
      description: message ? safeTranslate(message, translate) : undefined,
    });
  };
}

function findFirstMessage(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null;
  for (const key of Object.keys(errors)) {
    const value = (errors as Record<string, unknown>)[key];
    if (!value || typeof value !== 'object') continue;
    const maybeMessage = (value as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage) return maybeMessage;
    const nested = findFirstMessage(value);
    if (nested) return nested;
  }
  return null;
}

function safeTranslate(key: string, translate: (k: string) => string): string {
  try {
    const translated = translate(key);
    // next-intl throws on missing key in strict mode; if it returns the key
    // unchanged, fall back to the raw text so the user sees SOMETHING useful.
    return translated && translated !== key ? translated : key;
  } catch {
    return key;
  }
}
