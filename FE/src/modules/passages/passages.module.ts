import { FileText } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminPassagesPage } from './pages/AdminPassagesPage';

export const passagesModule: AppModule = {
  routes: [],
  adminRoutes: [{ path: '/admin/passages', Component: AdminPassagesPage }],
  adminNavItems: [{ to: '/admin/passages', label: 'Passages', icon: FileText }],
};
