'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Scale } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LEGAL_LAST_UPDATED,
  PrivacyBody,
  TermsBody,
} from '@/features/auth/legal-content';

export type LegalKind = 'terms' | 'privacy';

interface LegalModalProps {
  kind: LegalKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional acceptance callback - shown as the primary CTA when provided. */
  onAccept?: () => void;
}

/**
 * Premium legal document modal. Used for:
 *   - Terms of Use (kind="terms")
 *   - Privacy Policy (kind="privacy")
 *
 * Content is the canonical PT-BR version (legal text is not auto-translated to
 * avoid introducing liability drift between locales). UI chrome - titles,
 * CTAs, "last updated" - is i18n-driven.
 *
 * The document bodies themselves live in `./legal-content.tsx` so the public
 * `/terms` and `/privacy` pages render the exact same copy.
 */
export function LegalModal({ kind, open, onOpenChange, onAccept }: LegalModalProps) {
  const t = useTranslations();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Always scroll to the top when the modal opens so long documents start at
  // their beginning (and screen readers announce the title first).
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [open]);

  const isTerms = kind === 'terms';
  const Icon = isTerms ? Scale : ShieldCheck;
  const title = isTerms ? t('legal.terms.title') : t('legal.privacy.title');
  const subtitle = isTerms ? t('legal.terms.subtitle') : t('legal.privacy.subtitle');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-3xl p-0 overflow-hidden border border-white/10',
          'bg-gradient-to-b from-bg-secondary to-bg-primary',
          'sm:rounded-3xl',
        )}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-56 w-[130%] -translate-x-1/2 rounded-full bg-brand-600/15 blur-3xl" />
        </div>

        {/* Header */}
        <DialogHeader className="relative z-10 px-8 pt-8 pb-5 sm:px-10">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ring-1',
                isTerms
                  ? 'bg-brand-500/10 ring-brand-500/30'
                  : 'bg-emerald-500/10 ring-emerald-500/30',
              )}
            >
              <Icon
                className={cn('h-5 w-5', isTerms ? 'text-brand-400' : 'text-emerald-400')}
              />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold text-white">{title}</DialogTitle>
              <DialogDescription className="text-sm text-text-secondary">
                {subtitle}
              </DialogDescription>
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                {t('legal.lastUpdated', { date: LEGAL_LAST_UPDATED })}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className="relative z-10 max-h-[60vh] overflow-y-auto px-8 sm:px-10 pb-6 prose-legal"
        >
          {isTerms ? <TermsBody /> : <PrivacyBody />}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex flex-col-reverse gap-3 border-t border-white/[0.06] bg-white/[0.02] px-8 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p className="text-xs text-text-muted">
            {t('legal.footerNote')}
          </p>
          <div className="flex gap-3">
            {onAccept ? (
              <>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  {t('common.close')}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onAccept();
                    onOpenChange(false);
                  }}
                >
                  {t('legal.acceptCta')}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
