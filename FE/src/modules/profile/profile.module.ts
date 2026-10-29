import { User } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { TimezoneSync } from './components/TimezoneSync';
import { ProfilePage } from './pages/ProfilePage';

export const profileModule: AppModule = {
  routes: [{ path: '/profile', Component: ProfilePage }],
  navItems: [{ to: '/profile', label: 'Profile', icon: User }],
  // Sends the browser's time zone, so the learner's days are their own (SCRUM-31).
  widgets: [TimezoneSync],
};
