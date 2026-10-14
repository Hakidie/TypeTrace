import { Keyboard } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { TypingPage } from './pages/TypingPage';

export const typingModule: AppModule = {
  routes: [{ path: '/typing', Component: TypingPage }],
  navItems: [{ to: '/typing', label: 'Typing', icon: Keyboard }],
};
