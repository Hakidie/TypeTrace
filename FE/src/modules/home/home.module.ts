import type { AppModule } from '@/app/module.types';
import { HomePage } from './pages/HomePage';

export const homeModule: AppModule = {
  routes: [],
  // `/` is public: guests try typing there, signed-in users are sent on to the typing page.
  publicRoutes: [{ path: '/', Component: HomePage }],
};
