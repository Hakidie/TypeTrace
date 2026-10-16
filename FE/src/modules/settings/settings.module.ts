import { Settings } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

export const settingsModule: AppModule = {
  routes: [],
  adminRoutes: [{ path: '/admin/settings', Component: AdminSettingsPage }],
  adminNavItems: [{ to: '/admin/settings', label: 'Settings', icon: Settings }],
};
