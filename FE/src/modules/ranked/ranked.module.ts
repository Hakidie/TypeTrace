import { CalendarRange, Trophy } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminSeasonsPage } from './pages/AdminSeasonsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';

// The duels themselves are the Rank tab of the Typing page (`RankMode`); this module adds the pages around them.
export const rankedModule: AppModule = {
  routes: [{ path: '/leaderboard', Component: LeaderboardPage, guest: true }],
  navItems: [{ to: '/leaderboard', label: 'Leaderboard', labelKey: 'nav.leaderboard', icon: Trophy, guest: true }],
};

// The Seasons admin page is its own entry, registered after the Daily tasks module: the order of the modules is the order of the admin sidebar.
export const seasonsAdminModule: AppModule = {
  routes: [],
  adminRoutes: [{ path: '/admin/seasons', Component: AdminSeasonsPage }],
  adminNavItems: [{ to: '/admin/seasons', label: 'Seasons', labelKey: 'admin.pages.seasons', icon: CalendarRange }],
};
