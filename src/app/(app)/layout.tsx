import { AppShell } from '@/components/layout/app-shell';

// Force dynamic rendering since this is a client-authenticated SPA
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
