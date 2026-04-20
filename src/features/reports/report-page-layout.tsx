'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Shared wrapper every report page uses. Handles the three uniform
 * states (loading / error / empty) so each page's body only has to
 * deal with the happy path. Keeps the visual language identical
 * across the 4 reports — the "muito bem distribuído, profissional"
 * bar from the product spec.
 */

interface Props {
  title: string;
  description: string;
  filters: ReactNode;
  actions?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  errorMessage?: string;
  isEmpty: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export function ReportPageLayout({
  title,
  description,
  filters,
  actions,
  isLoading,
  isError,
  onRetry,
  errorMessage,
  isEmpty,
  children,
  footer,
}: Props) {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} action={actions} />

      {filters}

      {isLoading && (
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Spinner size="lg" />
          </CardContent>
        </Card>
      )}

      {!isLoading && isError && (
        <Card>
          <CardContent className="py-6 space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('notifications.errorOccurred')}</p>
                {errorMessage && (
                  <p className="text-xs text-red-200/80 mt-0.5">{errorMessage}</p>
                )}
              </div>
            </div>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" />
                {t('common.refresh')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && isEmpty && (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              title={t('reports.empty.title')}
              description={t('reports.empty.description')}
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && !isEmpty && children}

      {footer}
    </div>
  );
}
