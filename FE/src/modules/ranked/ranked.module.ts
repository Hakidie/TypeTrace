import { CalendarRange, Trophy } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { AdminSeasonsPage } from './pages/AdminSeasonsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';

// The duels themselves are the Rank tab of the Typing page (`RankMode`); this module adds the pages around them.
export const rankedModule: AppModule = {
  routes: [{ path: '/leaderboard', Component: LeaderboardPage }],
  navItems: [{ to: '/leaderboard', label: 'Leaderboard', icon: Trophy }],
  adminRoutes: [{ path: '/admin/seasons', Component: AdminSeasonsPage }],
  adminNavItems: [{ to: '/admin/seasons', label: 'Seasons', icon: CalendarRange }],
};
