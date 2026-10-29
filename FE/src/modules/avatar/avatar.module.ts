import type { AppModule } from '@/app/module.types';
import { WardrobePage } from './pages/WardrobePage';

// The wardrobe has no link in the top navigation: it opens from the account menu (`UserMenu`) and the profile page.
export const avatarModule: AppModule = {
  routes: [{ path: '/wardrobe', Component: WardrobePage }],
};
