import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { UserRole } from '@/modules/auth/types/auth.types';

/** A page reachable after login. Set `roles` to hide it from other users. */
export interface ModuleRoute {
  path: string;
  Component: ComponentType;
  roles?: UserRole[];
}

/** A page anyone can open, signed in or not, with no layout around it: the page draws its own header and footer. */
export interface PublicRoute {
  path: string;
  Component: ComponentType;
}

/** A link in the top navigation bar. */
export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

/** A component in the top navigation bar in place of a link, e.g. the AI chat button. Set `roles` to hide it from other users. */
export interface NavWidget {
  Component: ComponentType;
  roles?: UserRole[];
}

/** An entry in the account menu (the avatar menu in the header): a link (`to`) or an action (`onSelect`). Set `roles` to hide it from other users. */
export interface MenuItem {
  label: string;
  icon: LucideIcon;
  to?: string;
  onSelect?: () => void;
  /** Put the entry after Admin (default: before Admin). */
  last?: boolean;
  roles?: UserRole[];
}

/** What a feature module contributes to the app. Register it in `src/app/modules.ts`. */
export interface AppModule {
  /** Pages inside the main app layout (top navigation). */
  routes: ModuleRoute[];
  /** Pages for everyone, outside the login lock and the main layout (the home page for guests). */
  publicRoutes?: PublicRoute[];
  navItems?: (NavItem | NavWidget)[];
  /** Entries in the account menu: Wardrobe, Mode, these (AI chat), Admin, then the ones with `last` (Settings). */
  menuItems?: MenuItem[];
  /** Pages inside the admin area (`/admin/...`, sidebar layout). */
  adminRoutes?: ModuleRoute[];
  /** Links in the admin sidebar. */
  adminNavItems?: NavItem[];
  /** Components shown on every page of the main app, e.g. the floating chat button. */
  widgets?: ComponentType[];
}
