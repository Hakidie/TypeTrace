import { Palette, Settings } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminThemesPage } from '@/modules/admin/pages/AdminThemesPage';
import { FontSync } from './components/FontSync';
import { LanguageSync } from './components/LanguageSync';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { SettingsPage } from './pages/SettingsPage';

export const settingsModule: AppModule = {
  routes: [{ path: '/settings', Component: SettingsPage }],
  widgets: [FontSync, LanguageSync],
  menuItems: [{ to: '/settings', label: 'Settings', labelKey: 'menu.settings', icon: Settings, last: true }],
  // Themes come before Settings in the admin sidebar (right below Passages).
  adminRoutes: [
    { path: '/admin/themes', Component: AdminThemesPage },
    { path: '/admin/settings', Component: AdminSettingsPage },
  ],
  adminNavItems: [
    { to: '/admin/themes', label: 'Themes', labelKey: 'admin.pages.themes', icon: Palette },
    { to: '/admin/settings', label: 'Settings', labelKey: 'admin.pages.settings', icon: Settings },
  ],
};
