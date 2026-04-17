'use client';

import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useTrial } from '@/hooks/use-trial';
import type { GatedResource } from '@/types/trial';

interface GatedCreateButtonProps extends ButtonProps {
  /** Which plan limit this button creates against. */
  resource: GatedResource;
  /** How many records the action would create. Defaults to 1. */
  count?: number;
  /** Override title text when blocked. Falls back to i18n. */
  blockedTitle?: string;
}

/**
 * Drop-in replacement for the "Create" / "Add" button on any listing page.
 * Automatically disables itself when the caller's plan has reached the limit
 * or the trial is read-only, with a tooltip explaining why.
 *
 * Non-trial / legacy companies: behaves exactly like a regular <Button />.
 */
export const GatedCreateButton = forwardRef<HTMLButtonElement, GatedCreateButtonProps>(
  ({ resource, count = 1, blockedTitle, title, disabled, children, ...rest }, ref) => {
    const t = useTranslations();
    const { canCreate } = useTrial();
    const check = canCreate(resource, count);
    const isBlocked = !check.allowed;

    const reasonTitle =
      check.reason === 'TRIAL_EXPIRED'
        ? t('trial.errors.expired')
        : check.reason === 'TRIAL_LIMIT_REACHED'
          ? t('trial.errors.limitReached', { resource, limit: '' })
          : t('trial.errors.blocked');

    return (
      <Button
        ref={ref}
        disabled={disabled || isBlocked}
        title={isBlocked ? (blockedTitle ?? reasonTitle) : title}
        aria-disabled={disabled || isBlocked}
        {...rest}
      >
        {children}
      </Button>
    );
  },
);

GatedCreateButton.displayName = 'GatedCreateButton';
