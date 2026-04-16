'use client';

import { useTranslations } from 'next-intl';
import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@/lib/utils';
import { RoleBadge } from '@/components/shared/status-badge';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { ChatConnectionBadge } from '@/features/calls/call-dialog';
import { useCallContext } from '@/features/calls/call-context';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const t = useTranslations();
  const { user, logout } = useAuth();
  const call = useCallContext();

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-white/[0.06] bg-bg-primary/80 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        {/* Left: menu toggle */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {call && (
            <div className="hidden sm:block">
              <ChatConnectionBadge connected={call.socketConnected} />
            </div>
          )}
          <LocaleSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 h-10 px-2 py-1"
              >
                <Avatar className="h-8 w-8">
                  {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.firstName} />}
                  <AvatarFallback>{getInitials(user?.firstName, user?.lastName)}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-medium text-white leading-tight">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="text-xs text-text-muted leading-tight">{user?.email}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-white">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="text-xs text-text-muted font-normal">{user?.email}</span>
                  {user?.companyUser?.subtype && (
                    <div className="pt-1">
                      <RoleBadge role={user.companyUser.subtype} />
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-400">
                <LogOut className="h-4 w-4" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
