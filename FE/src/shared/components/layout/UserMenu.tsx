import { useState } from 'react';
import { LogOut, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useLogout } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { getTheme, setTheme, type Theme } from '@/shared/lib/utils';

const themes: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** The avatar as a button: it opens a menu with Theme (each press goes to the next theme) and Logout. */
export const UserMenu = ({ user }: { user?: CurrentUser }) => {
  const handleLogout = useLogout();
  const [current, setCurrent] = useState<Theme>(getTheme);
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';
  const index = themes.findIndex((theme) => theme.value === current);
  const { label, icon: ThemeIcon } = themes[index];

  const cycleTheme = () => {
    const next = themes[(index + 1) % themes.length].value;
    setTheme(next);
    setCurrent(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-9">
          <AvatarImage src={user?.avatarUrl} alt={user?.email} />
          <AvatarFallback className="bg-primary/15 text-sm text-primary">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={cycleTheme} className="gap-2">
          <ThemeIcon className="size-4" />
          Theme: {label}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="gap-2">
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
