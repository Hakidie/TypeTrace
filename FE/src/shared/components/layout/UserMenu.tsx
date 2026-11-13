import { LogOut, Moon, Shield, Shirt, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MenuItem } from '@/app/module.types';
import { useLogout } from '@/modules/auth/hooks/use-current-user';
import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { shownPictureUrl } from '@/modules/auth/utils/avatar-picture';
import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { PremiumBadge } from '@/shared/components/premium-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useThemeMode } from '@/modules/settings/hooks/use-theme-mode';

/** The avatar and the user's name as a button: it opens a menu with Wardrobe, Mode (each press switches between Light and Dark), AI chat, Admin (admins only: the link to the admin area), Settings and Logout (the entries modules add are `menuItems`; `last` ones come after Admin). */
export const UserMenu = ({ user, menuItems = [] }: { user?: CurrentUser; menuItems?: MenuItem[] }) => {
  const handleLogout = useLogout();
  const navigate = useNavigate();
  const { mode, setMode } = useThemeMode();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??';
  // The user's own name (the menu is theirs alone): the display name, or the start of their email without one.
  const name = user?.displayName || user?.email?.split('@')[0];
  const ModeIcon = mode === 'dark' ? Moon : Sun;

  // The entries modules add, after Mode (default) or after Admin (`last`), for the roles that may see them.
  const renderItems = (last: boolean) =>
    menuItems
      .filter((item) => !!item.last === last && (!item.roles || (user && item.roles.includes(user.role))))
      .map(({ label, icon: Icon, to, onSelect }) => (
        <DropdownMenuItem key={label} onClick={() => (to ? navigate(to) : onSelect?.())} className="gap-2">
          <Icon className="size-4" />
          {label}
        </DropdownMenuItem>
      ));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="group flex items-center py-1 pl-1 pr-1 text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-9">
          <AvatarImage src={shownPictureUrl(user)} alt={user?.email} />
          {/* No uploaded picture: the head of the pixel avatar (36px = the 40px head at 0.9). */}
          <AvatarFallback className="bg-transparent text-sm text-primary">
            {user ? <AvatarSprite look={user.avatar ?? DEFAULT_AVATAR} crop="head" scale={0.9} /> : initials}
          </AvatarFallback>
        </Avatar>
        {/* Name and crown share one drawer that opens beside the avatar while the button is hovered or focused
            (grid 0fr -> 1fr animates the width without a fixed size). Narrow screens keep the name out: the nav links need the room. */}
        {(name || user?.premium?.active) && (
          <span className="grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity] duration-300 ease-out group-hover:grid-cols-[1fr] group-hover:opacity-100 group-focus-visible:grid-cols-[1fr] group-focus-visible:opacity-100 motion-reduce:transition-none">
            <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap pl-2 pr-1">
              {name && <span className="hidden max-w-36 truncate tracking-wide xl:block">{name}</span>}
              {user?.premium?.active && <PremiumBadge className="shrink-0" />}
            </span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => navigate('/wardrobe')} className="gap-2">
          <Shirt className="size-4" />
          Wardrobe
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} className="gap-2">
          <ModeIcon className="size-4" />
          Mode: {mode === 'dark' ? 'Dark' : 'Light'}
        </DropdownMenuItem>
        {renderItems(false)}
        {user?.role === 'admin' && (
          <DropdownMenuItem onClick={() => navigate('/admin')} className="gap-2">
            <Shield className="size-4" />
            Admin
          </DropdownMenuItem>
        )}
        {renderItems(true)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="gap-2">
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
