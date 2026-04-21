'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Conservative defaults tuned for the admin console:
            //   • staleTime 2min: most screens (dashboards, CRUD lists,
            //     reports) tolerate 2-minute-old data; avoids refetch on
            //     every back/forth navigation. Real-time screens use
            //     Firestore listeners, not React Query polling, so this
            //     does not stale live alerts.
            //   • gcTime 10min: keep cached data after unmount so tab
            //     switches feel instant. Queries can still override.
            staleTime: 2 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
