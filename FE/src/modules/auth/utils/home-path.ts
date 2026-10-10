import type { UserRole } from '../types/auth.types';

/** Page opened right after signing in: admins go to the admin area, everyone else to the home page. */
export const homePathFor = (role: UserRole) => (role === 'admin' ? '/admin' : '/');
