import { ChartLine } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { ProgressPage } from './pages/ProgressPage';

export const progressModule: AppModule = {
  routes: [{ path: '/progress', Component: ProgressPage }],
  navItems: [{ to: '/progress', label: 'Progress', icon: ChartLine }],
};
