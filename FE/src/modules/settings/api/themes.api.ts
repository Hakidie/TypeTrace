import { http } from '@/shared/api/http';
import type { ActiveThemes, ActiveThemesInput, Theme, ThemeInput } from '../types/theme.types';

/** Every function resolves with the response body (not the Axios response). */
export const themesApi = {
  /** Published themes plus the user's own; `isDark` keeps only the themes of one mode. */
  list: (isDark: boolean) => http.get<Theme[]>('/themes', { params: { isDark } }).then((r) => r.data),
  create: (input: ThemeInput) => http.post<Theme>('/themes', input).then((r) => r.data),
  update: (id: string, input: Partial<ThemeInput>) => http.patch<Theme>(`/themes/${id}`, input).then((r) => r.data),
  remove: (id: string) => http.delete(`/themes/${id}`).then(() => undefined),
  getActive: () => http.get<ActiveThemes>('/themes/active').then((r) => r.data),
  updateActive: (input: ActiveThemesInput) => http.patch<ActiveThemes>('/themes/active', input).then((r) => r.data),
};
