import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { UserRole } from '@/modules/auth/types/auth.types';

/** A page reachable after login. Set `roles` to hide it from other users. */
export interface ModuleRoute {
  path: string;
  Component: ComponentType;
  roles?: UserRole[];
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

/** What a feature module contributes to the app. Register it in `src/app/modules.ts`. */
export interface AppModule {
  /** Pages inside the main app layout (top navigation). */
  routes: ModuleRoute[];
  navItems?: (NavItem | NavWidget)[];
  /** Pages inside the admin area (`/admin/...`, sidebar layout). */
  adminRoutes?: ModuleRoute[];
  /** Links in the admin sidebar. */
  adminNavItems?: NavItem[];
  /** Components shown on every page of the main app, e.g. the floating chat button. */
  widgets?: ComponentType[];
}
