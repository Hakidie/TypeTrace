import type { AppModule } from '@/app/module.types';
import { WardrobeRoute } from './pages/WardrobeRoute';

// The wardrobe has no link in the top navigation: it opens from the account menu (`UserMenu`) and the profile page.
// One route: the version shown (classic or modern) is a setting of the browser (`useWardrobeVersion`).
export const avatarModule: AppModule = {
  // A guest may open it (SCRUM-251) to try items on: the catalog is open to guests, saving and buying need an account.
  routes: [{ path: '/wardrobe', Component: WardrobeRoute, guest: true }],
};
