'use client';

import { useState } from 'react';
import { useAppForm } from '@/hooks/use-app-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Mail, CheckCircle2, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth.service';
import { recoveryEmailSchema, type RecoveryEmailValues } from './schemas';

interface RequestUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill email from the login form when the user clicked the unlock CTA */
  defaultEmail?: string;
}

/**
 * "Send me an unlock email" dialog.
 *
 * Visible after the login mutation hits HTTP 429 (per-account throttle
 * has triggered backoff). The backend `requestUnlock` endpoint always
 * answers HTTP 200 with a generic message regardless of whether the
 * email is registered — so we ALWAYS render the success screen on
 * completion, never branching on existence. That branching would
 * leak account enumeration.
 *
 * Reuses `recoveryEmailSchema` from the password-recovery flow since
 * the input is the same shape (a single trimmed lowercase email).
 */
export function RequestUnlockDialog({
  open,
  onOpenChange,
  defaultEmail = '',
}: RequestUnlockDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <RequestUnlockDialogContent
          defaultEmail={defaultEmail}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

interface RequestUnlockDialogContentProps {
  defaultEmail: string;
  onClose: () => void;
}

/** Mounting the content per opening gives the form and success screen a fresh state. */
function RequestUnlockDialogContent({ defaultEmail, onClose }: RequestUnlockDialogContentProps) {
  const t = useTranslations();
  const [submitted, setSubmitted] = useState(false);

  const form = useAppForm<RecoveryEmailValues>({
    resolver: zodResolver(recoveryEmailSchema),
    defaultValues: { email: defaultEmail },
  });

  const request = useMutation({
    mutationFn: (email: string) => authService.requestUnlock(email),
    // Always success-path the UI — anti user-enumeration. Network
    // errors flow into onError below where we *also* show success
    // to keep the response shape uniform from the user's POV.
    onSettled: () => setSubmitted(true),
  });

  const onSubmit = (data: RecoveryEmailValues) => {
    request.mutate(data.email);
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="text-brand-400 h-5 w-5" />
          {t('auth.unlock.requestTitle')}
        </DialogTitle>
        <DialogDescription>{t('auth.unlock.requestSubtitle')}</DialogDescription>
      </DialogHeader>

      {!submitted ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unlock-email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                id="unlock-email"
                type="email"
                autoComplete="email"
                className="pl-10"
                placeholder="seu@email.com"
                {...form.register('email')}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-xs text-red-400">
                {t(form.formState.errors.email.message as string)}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={request.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={request.isPending}>
              {request.isPending ? t('common.loading') : t('auth.unlock.requestCta')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-400" />
          <h3 className="text-text-primary mb-1 text-base font-semibold">
            {t('auth.unlock.requestSentTitle')}
          </h3>
          <p className="text-text-secondary mb-4 text-sm">
            {t('auth.unlock.requestSentDescription')}
          </p>
          <Button type="button" onClick={onClose} className="w-full">
            {t('common.close')}
          </Button>
        </div>
      )}
    </DialogContent>
  );
}
