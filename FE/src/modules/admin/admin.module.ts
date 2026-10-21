import { LayoutDashboard, Palette, Shield, Users } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminThemesPage } from './pages/AdminThemesPage';
import { AdminUsersPage } from './pages/AdminUsersPage';

export const adminModule: AppModule = {
  routes: [],
  // Link from the main app to the admin area, shown to admins only.
  navItems: [{ to: '/admin', label: 'Admin', icon: Shield, roles: ['admin'] }],
  adminRoutes: [
    { path: '/admin', Component: AdminDashboardPage },
    { path: '/admin/users', Component: AdminUsersPage },
    { path: '/admin/themes', Component: AdminThemesPage },
  ],
  adminNavItems: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/themes', label: 'Themes', icon: Palette },
  ],
};
