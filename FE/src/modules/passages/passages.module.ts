import { FileText } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminPassagesPage } from './pages/AdminPassagesPage';
import { PassagesPage } from './pages/PassagesPage';

export const passagesModule: AppModule = {
  // Learners: the passages to practice and their own ones (`/api/passages`).
  routes: [{ path: '/passages', Component: PassagesPage }],
  navItems: [{ to: '/passages', label: 'Passages', icon: FileText }],
  // Admins: the passage bank (`/api/admin/passages`).
  adminRoutes: [{ path: '/admin/passages', Component: AdminPassagesPage }],
  adminNavItems: [{ to: '/admin/passages', label: 'Passages', icon: FileText }],
};
