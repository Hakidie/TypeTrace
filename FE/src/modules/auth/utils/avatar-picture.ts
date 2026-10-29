import type { CurrentUser } from '../types/auth.types';

/** The uploaded picture an account shows: none while it has chosen its pixel avatar (the picture is kept for when it switches back). */
export const shownPictureUrl = (user?: Pick<CurrentUser, 'avatarUrl' | 'avatarSource'>) =>
  user?.avatarSource === 'pixel' ? undefined : user?.avatarUrl;
