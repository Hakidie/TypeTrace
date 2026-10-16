import { Keyboard } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { PlacementIntroPage } from './pages/PlacementIntroPage';
import { TypingPage } from './pages/TypingPage';
import { TypingResultPage } from './pages/TypingResultPage';

export const typingModule: AppModule = {
  routes: [
    // Opened after every login and registration (afterLoginPathFor); no nav link.
    { path: '/placement', Component: PlacementIntroPage },
    { path: '/typing', Component: TypingPage },
    { path: '/typing/result/:id', Component: TypingResultPage },
  ],
  navItems: [{ to: '/typing', label: 'Typing', icon: Keyboard }],
};
