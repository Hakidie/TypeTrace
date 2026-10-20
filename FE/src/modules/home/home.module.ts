import type { AppModule } from '@/app/module.types';
import { HomeRedirect } from './pages/HomeRedirect';

export const homeModule: AppModule = {
  routes: [{ path: '/', Component: HomeRedirect }],
};
