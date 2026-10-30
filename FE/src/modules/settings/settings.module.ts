import { Palette, Settings } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminThemesPage } from '@/modules/admin/pages/AdminThemesPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { SettingsPage } from './pages/SettingsPage';

export const settingsModule: AppModule = {
  routes: [{ path: '/settings', Component: SettingsPage }],
  menuItems: [{ to: '/settings', label: 'Settings', icon: Settings, last: true }],
  // Themes come before Settings in the admin sidebar (right below Passages).
  adminRoutes: [
    { path: '/admin/themes', Component: AdminThemesPage },
    { path: '/admin/settings', Component: AdminSettingsPage },
  ],
  adminNavItems: [
    { to: '/admin/themes', label: 'Themes', icon: Palette },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ],
};
