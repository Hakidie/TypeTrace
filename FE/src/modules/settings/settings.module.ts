import { Settings } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { SettingsPage } from './pages/SettingsPage';

export const settingsModule: AppModule = {
  routes: [{ path: '/settings', Component: SettingsPage }],
  navItems: [{ to: '/settings', label: 'Settings', icon: Settings }],
  adminRoutes: [{ path: '/admin/settings', Component: AdminSettingsPage }],
  adminNavItems: [{ to: '/admin/settings', label: 'Settings', icon: Settings }],
};
