import { LogIn, Moon, Sun, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { useThemeMode } from '@/modules/settings/hooks/use-theme-mode';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

/**
 * The account menu of the login pages: looks like `UserMenu` (the head of the default avatar and a name), but for a guest.
 * Its menu has Mode (only remembered in the browser here), Login and Register.
 */
export const GuestMenu = () => {
  const navigate = useNavigate();
  const { mode, setMode } = useThemeMode();
  const ModeIcon = mode === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Guest menu"
        className="flex items-center gap-2 py-1 pl-1 pr-1 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:pr-3"
      >
        <Avatar className="size-9">
          {/* The head of the default pixel avatar (36px = the 40px head at 0.9), like the signed-in menu. */}
          <AvatarFallback className="bg-transparent text-sm text-primary">
            <AvatarSprite look={DEFAULT_AVATAR} crop="head" scale={0.9} />
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-36 truncate xl:inline">Guest</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} className="gap-2">
          <ModeIcon className="size-4" />
          Mode: {mode === 'dark' ? 'Dark' : 'Light'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/login')} className="gap-2">
          <LogIn className="size-4" />
          Login
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/register')} className="gap-2">
          <UserPlus className="size-4" />
          Register
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
