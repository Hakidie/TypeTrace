import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { http } from '@/shared/api/http';
import type { AvatarCatalog, AvatarLook } from '../types/avatar.types';

/** Every function resolves with the response body (not the Axios response). */
export const avatarApi = {
  catalog: () => http.get<AvatarCatalog>('/avatar/catalog').then((r) => r.data),
  update: (look: AvatarLook) => http.put<CurrentUser>('/avatar', look).then((r) => r.data),
};
