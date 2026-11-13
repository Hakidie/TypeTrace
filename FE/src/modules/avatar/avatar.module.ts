import type { AppModule } from '@/app/module.types';
import { WardrobeRoute } from './pages/WardrobeRoute';

// The wardrobe has no link in the top navigation: it opens from the account menu (`UserMenu`) and the profile page.
// One route: the version shown (classic or modern) is a setting of the browser (`useWardrobeVersion`).
export const avatarModule: AppModule = {
  routes: [{ path: '/wardrobe', Component: WardrobeRoute }],
};
