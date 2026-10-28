import { http } from '@/shared/api/http';
import type { Paginated } from '@/shared/api/types';
import type { DailyTask, DailyTaskInput, DailyTaskListParams, DailyTaskSettings } from '../types/daily-task.types';

/** Drops empty values so the URL stays clean (`?type=` is never sent). */
const cleanParams = (params: DailyTaskListParams) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));

/** Every function resolves with the response body (not the Axios response). */
export const dailyTasksApi = {
  list: (params: DailyTaskListParams = {}) =>
    http.get<Paginated<DailyTask>>('/admin/daily-tasks', { params: cleanParams(params) }).then((r) => r.data),
  create: (input: DailyTaskInput) => http.post<DailyTask>('/admin/daily-tasks', input).then((r) => r.data),
  update: (id: string, input: Partial<DailyTaskInput>) =>
    http.patch<DailyTask>(`/admin/daily-tasks/${id}`, input).then((r) => r.data),
  remove: (id: string) => http.delete(`/admin/daily-tasks/${id}`).then(() => undefined),
  getSettings: () => http.get<DailyTaskSettings>('/admin/daily-tasks/settings').then((r) => r.data),
  updateSettings: (settings: DailyTaskSettings) =>
    http.put<DailyTaskSettings>('/admin/daily-tasks/settings', settings).then((r) => r.data),
};
