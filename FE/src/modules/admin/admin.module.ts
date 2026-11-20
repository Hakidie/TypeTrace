import { LayoutDashboard, Users } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUsersPage } from './pages/AdminUsersPage';

export const adminModule: AppModule = {
  routes: [],
  adminRoutes: [
    { path: '/admin', Component: AdminDashboardPage },
    { path: '/admin/users', Component: AdminUsersPage },
  ],
  adminNavItems: [
    { to: '/admin', label: 'Dashboard', labelKey: 'admin.pages.dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', labelKey: 'admin.pages.users', icon: Users },
  ],
};
