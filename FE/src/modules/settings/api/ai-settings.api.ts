import { http } from '@/shared/api/http';
import type { AiSettings } from '../types/ai-settings.types';

/** Admin only. Every function resolves with the response body (not the Axios response). */
export const aiSettingsApi = {
  get: () => http.get<AiSettings>('/admin/ai/settings').then((r) => r.data),
  update: (settings: AiSettings) => http.put<AiSettings>('/admin/ai/settings', settings).then((r) => r.data),
};
