import type { UserRole } from '../types/auth.types';

/** Home page of a role: admins have the admin area, everyone else `/`, which opens the typing page. */
export const homePathFor = (role: UserRole) => (role === 'admin' ? '/admin' : '/');

/** Page opened right after logging in or registering: admins go to the admin area, learners to the typing page (Practice). */
export const afterLoginPathFor = (role: UserRole) => (role === 'admin' ? '/admin' : '/typing');

/**
 * History state of that page after the first login of an account just created (registration, or a first Google login):
 * the typing page then asks the new learner to take the placement test (SCRUM-157).
 */
export interface AfterLoginState {
  newAccount?: boolean;
}
