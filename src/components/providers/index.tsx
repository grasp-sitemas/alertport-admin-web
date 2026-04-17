'use client';

import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { IntlProvider } from './intl-provider';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';
import { TrialProvider } from './trial-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <IntlProvider>
      <QueryProvider>
        <AuthProvider>
          <TrialProvider>
            <TooltipProvider>
              {children}
              <Toaster
                position="top-right"
                theme="dark"
                toastOptions={{
                  style: {
                    background: '#1a2234',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                  },
                }}
              />
            </TooltipProvider>
          </TrialProvider>
        </AuthProvider>
      </QueryProvider>
    </IntlProvider>
  );
}
