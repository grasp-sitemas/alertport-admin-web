'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { navigation, type NavItem, type NavSection } from '@/config/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSessionAccountModules } from '@/features/modules/use-session-account-modules';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'alertport-admin-sidebar-open-section';

/**
 * Stored shape — section key + the pathname the user was on when they
 * clicked. The pathname stamp lets us tell apart "user opened this
 * tray on the current page" (their intent should win over active
 * route detection) from "user opened it earlier on a different page"
 * (active route detection should win after navigation).
 *
 * Stored as a JSON object; legacy bare-string values from older
 * deploys are tolerated by `getStoredEntry` and treated as a sticky
 * preference with no pathname stamp.
 */
type StoredEntry = { value: string; pathname: string } | null;

// Per-tab pub-sub for useSyncExternalStore. localStorage's native
// `storage` event only fires cross-tab, so we publish to listeners in
// the same tab ourselves. Module-scoped so multiple Sidebar instances
// (mobile + desktop, in theory) share one signal.
const storageListeners = new Set<() => void>();
function notifyStorageChange() {
  for (const fn of storageListeners) fn();
}
function subscribeStorage(onChange: () => void) {
  storageListeners.add(onChange);
  // Also react to writes in other tabs so the open section stays in
  // sync — matches what shadcn-style theme stores do.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onChange);
  }
  return () => {
    storageListeners.delete(onChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onChange);
    }
  };
}

// Snapshot must be referentially stable when the underlying value
// hasn't changed, otherwise useSyncExternalStore loops. We cache the
// last serialized payload + parsed object.
let cachedRaw: string | null = null;
let cachedEntry: StoredEntry = null;
function getStoredEntry(): StoredEntry {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedEntry;
  cachedRaw = raw;
  if (!raw) {
    cachedEntry = null;
    return null;
  }
  // New shape: JSON {value, pathname}. Legacy bare strings get treated
  // as a sticky preference with no pathname stamp.
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<{ value: string; pathname: string }>;
      if (parsed && typeof parsed.value === 'string') {
        cachedEntry = { value: parsed.value, pathname: parsed.pathname ?? '' };
        return cachedEntry;
      }
    } catch {
      // fall through to legacy handling
    }
  }
  cachedEntry = { value: raw, pathname: '' };
  return cachedEntry;
}
function getServerStoredEntry(): StoredEntry {
  return null;
}

/** Match logic: same as the legacy flat sidebar — exact path or sub-route. */
function isItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Find the section that owns the active route. Used both to decide the
 * default open section on first paint and to switch sections when the
 * user navigates from inside one section into another.
 */
function findActiveSectionKey(
  sections: NavSection[],
  pathname: string | null,
): string | undefined {
  if (!pathname) return undefined;
  for (const section of sections) {
    if (section.items.some((it) => isItemActive(pathname, it.href))) {
      return section.titleKey;
    }
  }
  return undefined;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { userSubtype } = useAuth();
  const modules = useSessionAccountModules();

  // Two-stage filter:
  //   1. Role - strictest, removes items the current subtype can't see.
  //   2. Account module - per-tenant feature flag. SUPER_ADMIN_MASTER
  //      bypasses this (modules.isEnabled returns true for SAM).
  const filteredNavigation = useMemo<NavSection[]>(
    () =>
      navigation
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (!userSubtype || !item.roles.includes(userSubtype)) return false;
            if (item.moduleKey && !modules.isEnabled(item.moduleKey)) return false;
            return true;
          }),
        }))
        .filter((section) => section.items.length > 0),
    [userSubtype, modules],
  );

  const activeSectionKey = useMemo(
    () => findActiveSectionKey(filteredNavigation, pathname),
    [filteredNavigation, pathname],
  );

  // The user's last manual toggle lives in localStorage along with the
  // pathname they were on when they made it. We read both via
  // useSyncExternalStore so SSR is safe (snapshot returns null on the
  // server) and we don't need a setState-in-effect dance.
  const stored = useSyncExternalStore(
    subscribeStorage,
    getStoredEntry,
    getServerStoredEntry,
  );

  // Resolution rule (mirrors the brief):
  //   1. If the user has toggled the accordion *since the last
  //      navigation* (stored.pathname === pathname), their choice wins.
  //      That covers "I'm on /alerts/monitor but I want to peek at
  //      Reports without leaving the page".
  //   2. Otherwise the active route's section wins — the sidebar
  //      should always reveal where you are after a navigation.
  //   3. Fallback: restore the user's last manual choice (initial mount
  //      with no active match).
  //   4. Nothing — explicit "" so Radix treats nothing as open.
  const userOverride =
    stored && stored.pathname === pathname ? stored.value : null;
  const openSection = userOverride ?? activeSectionKey ?? stored?.value ?? '';

  const handleValueChange = useCallback(
    (next: string) => {
      // Persist the user-driven toggle, stamped with the current path so
      // the next navigation can decide whether it still represents the
      // user's intent (see resolution rule above). We also record empty
      // strings (= "I deliberately collapsed everything here") so the
      // user can override the active-route auto-open.
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ value: next, pathname: pathname ?? '' }),
        );
      } catch {
        // localStorage can throw in private mode / storage quota — non-fatal.
      }
      // localStorage's `storage` event only fires cross-tab. Notify our
      // own useSyncExternalStore subscribers in this tab.
      notifyStorageChange();
    },
    [pathname],
  );

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
        <nav className="flex-1 overflow-y-auto p-4" aria-label={t('common.appName')}>
          <Accordion
            type="single"
            collapsible
            value={openSection ?? ''}
            onValueChange={handleValueChange}
            className="space-y-1"
          >
            {filteredNavigation.map((section) => {
              const isActiveSection = activeSectionKey === section.titleKey;
              const SectionIcon = section.icon;

              // Single-item sections render flat — there is no value
              // in the user expanding a tray to see one link.
              if (section.items.length === 1) {
                const only = section.items[0];
                return (
                  <FlatSectionLink
                    key={section.titleKey}
                    item={only}
                    sectionIcon={SectionIcon}
                    pathname={pathname}
                    onClose={onClose}
                    label={t(only.titleKey)}
                  />
                );
              }

              return (
                <AccordionItem
                  key={section.titleKey}
                  value={section.titleKey}
                  className="rounded-xl"
                >
                  <AccordionTrigger
                    className={cn(
                      isActiveSection &&
                        'bg-brand-600/[0.08] text-white hover:bg-brand-600/[0.12]',
                    )}
                    aria-label={t(section.titleKey)}
                  >
                    <span className="flex items-center gap-3">
                      <SectionIcon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActiveSection
                            ? 'text-brand-500'
                            : 'text-text-muted group-hover:text-white',
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{t(section.titleKey)}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="ml-[1.125rem] space-y-1 border-l border-white/[0.06] pl-3">
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <NavLink
                            item={item}
                            pathname={pathname}
                            onClose={onClose}
                            label={t(item.titleKey)}
                          />
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.06] p-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-xs text-text-muted">AlertPort Admin · v1.0</p>
            <p className="text-[10px] text-text-muted mt-1">
              {t('common.appName')} · © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

interface NavLinkProps {
  item: NavItem;
  pathname: string | null;
  onClose: () => void;
  label: string;
}

function NavLink({ item, pathname, onClose, label }: NavLinkProps) {
  const isActive = isItemActive(pathname, item.href);
  const Icon = item.icon;
  // Derive an onboarding anchor slug from the i18n key
  // ("sidebar.alertMonitor" -> "alertMonitor"). Used by the guided
  // tour to spotlight menu items by role.
  const tourSlug = item.titleKey.replace(/^sidebar\./, '');

  return (
    <Link
      href={item.href}
      data-tour={`sidebar-${tourSlug}`}
      onClick={() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) onClose();
      }}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-brand-600/15 text-white border border-brand-600/30'
          : 'text-text-secondary hover:bg-white/[0.04] hover:text-white',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          isActive ? 'text-brand-500' : 'text-text-muted group-hover:text-white',
        )}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

interface FlatSectionLinkProps {
  item: NavItem;
  sectionIcon: NavSection['icon'];
  pathname: string | null;
  onClose: () => void;
  label: string;
}

/**
 * One-item sections render as a top-level link styled like the section
 * trigger (icon + label, no chevron). The section's icon wins so the
 * Dashboard rail stays visually consistent with the other section heads.
 */
function FlatSectionLink({
  item,
  sectionIcon: SectionIcon,
  pathname,
  onClose,
  label,
}: FlatSectionLinkProps) {
  const isActive = isItemActive(pathname, item.href);
  const tourSlug = item.titleKey.replace(/^sidebar\./, '');

  return (
    <Link
      href={item.href}
      data-tour={`sidebar-${tourSlug}`}
      onClick={() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) onClose();
      }}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-brand-600/15 text-white border border-brand-600/30'
          : 'text-text-secondary hover:bg-white/[0.04] hover:text-white',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <SectionIcon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          isActive ? 'text-brand-500' : 'text-text-muted group-hover:text-white',
        )}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
