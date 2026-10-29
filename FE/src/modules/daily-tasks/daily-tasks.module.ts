import { CalendarCheck } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminDailyTasksPage } from './pages/AdminDailyTasksPage';

export const dailyTasksModule: AppModule = {
  routes: [],
  // Admins: the daily task templates and how many a learner gets a day (`/api/admin/daily-tasks`, SCRUM-210).
  adminRoutes: [{ path: '/admin/daily-tasks', Component: AdminDailyTasksPage }],
  adminNavItems: [{ to: '/admin/daily-tasks', label: 'Daily tasks', icon: CalendarCheck }],
};
