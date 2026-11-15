import { Keyboard } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { TypingRoute } from './pages/TypingRoute';
import { TypingResultPage } from './pages/TypingResultPage';

export const typingModule: AppModule = {
  routes: [
    // Opened after every login and registration (afterLoginPathFor) and by `/`.
    { path: '/typing', Component: TypingRoute, guest: true },
    { path: '/typing/result/:id', Component: TypingResultPage },
  ],
  navItems: [{ to: '/typing', label: 'Typing', icon: Keyboard, guest: true }],
};
