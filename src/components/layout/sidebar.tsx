'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { navigation } from '@/config/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { userSubtype } = useAuth();

  const filteredNavigation = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => userSubtype && item.roles.includes(userSubtype)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/[0.06] bg-bg-secondary/95 backdrop-blur-xl transition-transform duration-300 ease-out lg:translate-x-0 lg:relative lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-6">
          <Logo />
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {filteredNavigation.map((section) => (
            <div key={section.titleKey} className="mb-6">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t(section.titleKey)}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname?.startsWith(item.href + '/');
                  const Icon = item.icon;

                  // Derive an onboarding anchor slug from the i18n key
                  // ("sidebar.alertMonitor" -> "alertMonitor"). Used by
                  // the guided tour to spotlight menu items by role.
                  const tourSlug = item.titleKey.replace(/^sidebar\./, '');

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        data-tour={`sidebar-${tourSlug}`}
                        onClick={() => {
                          // Close on mobile after navigation
                          if (window.innerWidth < 1024) onClose();
                        }}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          isActive
                            ? 'bg-brand-600/15 text-white border border-brand-600/30'
                            : 'text-text-secondary hover:bg-white/[0.04] hover:text-white',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            isActive ? 'text-brand-500' : 'text-text-muted group-hover:text-white',
                          )}
                        />
                        <span className="truncate">{t(item.titleKey)}</span>
                        {isActive && (
                          <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(179,38,30,0.6)]" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.06] p-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-xs text-text-muted">
              AlertPort Admin · v1.0
            </p>
            <p className="text-[10px] text-text-muted mt-1">
              {t('common.appName')} · © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
