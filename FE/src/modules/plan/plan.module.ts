import { Crown } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminPlansPage } from './pages/AdminPlansPage';

/** Free and Premium (US11.1): the badge on the profile and, in the admin area, the plans and who is on them. */
export const planModule: AppModule = {
  routes: [],
  // Admins: the Free and Premium plans (`/api/admin/plans`).
  adminRoutes: [{ path: '/admin/plans', Component: AdminPlansPage }],
  adminNavItems: [{ to: '/admin/plans', label: 'Plans', icon: Crown }],
};
