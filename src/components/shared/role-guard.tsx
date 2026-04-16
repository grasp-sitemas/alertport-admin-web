'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { UserSubtype } from '@/types/api';
import { Spinner } from '@/components/ui/spinner';

interface RoleGuardProps {
  roles: UserSubtype[];
  children: React.ReactNode;
  fallbackPath?: string;
}

export function RoleGuard({ roles, children, fallbackPath = '/dashboard' }: RoleGuardProps) {
  const router = useRouter();
  const { hasRole, user } = useAuth();

  useEffect(() => {
    if (user && !hasRole(roles)) {
      router.replace(fallbackPath);
    }
  }, [user, hasRole, roles, router, fallbackPath]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasRole(roles)) {
    return null;
  }

  return <>{children}</>;
}
