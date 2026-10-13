// Spike page: checks how Vietnamese IMEs send events before the typing screen is designed.
// Results: docs/spikes/ime-input-events.md
import { Keyboard } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { InputLabPage } from './pages/InputLabPage';

export const inputLabModule: AppModule = {
  routes: [{ path: '/lab/input', Component: InputLabPage }],
  navItems: [{ to: '/lab/input', label: 'Input lab', icon: Keyboard }],
};
