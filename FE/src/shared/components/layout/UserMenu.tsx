import { LogOut, Moon, Sun } from 'lucide-react';
import { useLogout } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useThemeMode } from '@/modules/settings/hooks/use-theme-mode';

/** The avatar as a button: it opens a menu with Mode (each press switches between Light and Dark) and Logout. */
export const UserMenu = ({ user }: { user?: CurrentUser }) => {
  const handleLogout = useLogout();
  const { mode, setMode } = useThemeMode();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';
  const ModeIcon = mode === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-9">
          <AvatarImage src={user?.avatarUrl} alt={user?.email} />
          <AvatarFallback className="bg-primary/15 text-sm text-primary">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} className="gap-2">
          <ModeIcon className="size-4" />
          Mode: {mode === 'dark' ? 'Dark' : 'Light'}
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
