import type { AppModule } from '@/app/module.types';
import { HomePage } from './pages/HomePage';

export const homeModule: AppModule = {
  routes: [{ path: '/', Component: HomePage }],
};
