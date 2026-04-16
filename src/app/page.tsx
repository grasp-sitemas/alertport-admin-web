'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSessionValid } from '@/lib/session';
import { Spinner } from '@/components/ui/spinner';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (isSessionValid()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient">
      <Spinner size="lg" />
    </div>
  );
}
