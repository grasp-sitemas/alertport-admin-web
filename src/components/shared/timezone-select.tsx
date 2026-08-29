'use client';

/**
 * Timezone picker — used by signup, /company and the SUPER_ADMIN
 * /companies CRUD. Pairs a text input with a `<datalist>` for native
 * autocomplete over the full IANA list, plus a row of one-click
 * suggestion chips (detected zone first, then curated commons).
 *
 * Why not a Radix Select: the IANA list has ~400 zones. A dropdown of
 * that size is unusable; the native `<datalist>` lets the operator
 * type-to-filter (e.g. "sao_p" → America/Sao_Paulo) while still getting
 * the full list for scroll-and-click when they don't know what to type.
 *
 * The datalist id is parameterized so multiple timezone pickers can
 * coexist on a single page (e.g. a /companies list with the create and
 * edit dialogs mounted simultaneously).
 */
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { COMMON_TIMEZONES, getAllTimezones } from '@/features/auth/timezones';

/**
 * Best-effort detection of the browser's current timezone. Falls back to
 * America/Sao_Paulo (the AlertPort primary market) when the runtime
 * can't resolve it — preferable to an empty value the operator would
 * have to manually fill on every signup.
 */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

export interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  /**
   * DOM id for the `<datalist>`. Must be unique per page mount so the
   * browser wires autocomplete to the right input. Defaults to
   * "timezone-options" which is fine when there's only one picker.
   */
  datalistId?: string;
  /**
   * Override the set of one-click chips. Defaults to COMMON_TIMEZONES.
   */
  suggested?: string[];
  /**
   * Pre-detected zone shown first with a "detected" tag. Resolved from
   * the browser if omitted.
   */
  detected?: string;
  placeholder?: string;
  /** Name attr used by react-hook-form integrations. */
  name?: string;
  disabled?: boolean;
}

export function TimezoneSelect({
  value,
  onChange,
  datalistId = 'timezone-options',
  suggested = COMMON_TIMEZONES,
  detected,
  placeholder = 'America/Sao_Paulo',
  name,
  disabled,
}: TimezoneSelectProps) {
  const t = useTranslations();
  // Always call the hook unconditionally (rules of hooks) — the `detected`
  // prop takes precedence when present via the ternary below.
  const autoDetected = useMemo(() => detectBrowserTimezone(), []);
  const detectedTz = detected ?? autoDetected;
  const allTimezones = useMemo(() => getAllTimezones(detectedTz), [detectedTz]);

  // Detected first, then curated commons minus whatever is already detected,
  // capped at 6 chips so the row doesn't wrap into a wall of pills.
  const chips = useMemo(() => {
    return [detectedTz, ...suggested.filter((s) => s !== detectedTz)].slice(0, 6);
  }, [detectedTz, suggested]);

  return (
    <div className="space-y-2">
      <Input
        list={datalistId}
        autoComplete="off"
        value={value}
        name={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <datalist id={datalistId}>
        {allTimezones.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((tz) => (
          <button
            key={tz}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tz)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              value === tz
                ? 'bg-brand-500/20 text-brand-200 ring-brand-500/40 ring-1'
                : 'text-text-secondary bg-white/5 hover:bg-white/10',
            )}
          >
            {tz === detectedTz ? `${tz} · ${t('signup.company.timezoneDetected')}` : tz}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Pure helper exposed for tests + callers that need the chip list
 * without rendering the component (e.g. telemetry or default-selection
 * logic). Mirrors the component's internal ordering.
 */
export function buildTimezoneChips(
  detected: string,
  suggested: string[] = COMMON_TIMEZONES,
  max = 6,
): string[] {
  return [detected, ...suggested.filter((s) => s !== detected)].slice(0, max);
}
