'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { CallProvider } from '@/features/calls/call-context';
import { SilentListenBanner } from '@/features/calls/silent-listen-banner';
import { TrialBanner } from '@/components/trial/trial-banner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Give AuthProvider time to hydrate
    const timeout = setTimeout(() => {
      setChecked(true);
      if (!isAuthenticated) {
        router.replace('/login');
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, [isAuthenticated, router]);

  if (!checked || !isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-gradient">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <CallProvider>
      <div className="flex min-h-screen bg-app-gradient">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex flex-1 flex-col lg:ml-0 min-w-0">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <TrialBanner />
          <SilentListenBanner />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </CallProvider>
  );
}
