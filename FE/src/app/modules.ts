import { adminModule } from '@/modules/admin/admin.module';
import { chatModule } from '@/modules/chat/chat.module';
import { homeModule } from '@/modules/home/home.module';
import { inputLabModule } from '@/modules/input-lab/input-lab.module';
import { notesModule } from '@/modules/notes/notes.module';
import { profileModule } from '@/modules/profile/profile.module';
import type { AppModule } from './module.types';

/**
 * Every feature module shown after login. Adding a module = one import + one
 * entry here; its routes, nav links, admin pages and widgets are picked up automatically.
 * Order decides the order of the navigation links.
 */
export const appModules: AppModule[] = [homeModule, notesModule, inputLabModule, chatModule, profileModule, adminModule];

export const protectedRoutes = appModules.flatMap((module) => module.routes);
export const navItems = appModules.flatMap((module) => module.navItems ?? []);
export const adminRoutes = appModules.flatMap((module) => module.adminRoutes ?? []);
export const adminNavItems = appModules.flatMap((module) => module.adminNavItems ?? []);
export const appWidgets = appModules.flatMap((module) => module.widgets ?? []);
