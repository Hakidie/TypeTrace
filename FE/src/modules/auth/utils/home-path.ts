import type { UserRole } from '../types/auth.types';

/** Home page of a role: admins have the admin area, everyone else the home page. */
export const homePathFor = (role: UserRole) => (role === 'admin' ? '/admin' : '/');

/** Page opened right after logging in or registering: admins go to the admin area, learners to the placement test intro. */
export const afterLoginPathFor = (role: UserRole) => (role === 'admin' ? '/admin' : '/placement');
