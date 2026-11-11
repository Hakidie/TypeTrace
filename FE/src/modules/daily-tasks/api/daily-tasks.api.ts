import { http } from '@/shared/api/http';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { Paginated } from '@/shared/api/types';
import type {
  DailyTask,
  DailyTaskInput,
  DailyTaskListItem,
  DailyTaskListParams,
  DailyTaskSettings,
  TaskCompletionsChartData,
  MinigameKind,
} from '../types/daily-task.types';

/** Drops empty values so the URL stays clean (`?type=` is never sent). */
const cleanParams = (params: DailyTaskListParams) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));

/** Every function resolves with the response body (not the Axios response). */
export const dailyTasksApi = {
  /** Each task with the learners who completed it in the last 24 hours (`completions`). */
  list: (params: DailyTaskListParams = {}) =>
    http.get<Paginated<DailyTaskListItem>>('/admin/daily-tasks', { params: cleanParams(params) }).then((r) => r.data),
  create: (input: DailyTaskInput) => http.post<DailyTask>('/admin/daily-tasks', input).then((r) => r.data),
  update: (id: string, input: Partial<DailyTaskInput>) =>
    http.patch<DailyTask>(`/admin/daily-tasks/${id}`, input).then((r) => r.data),
  remove: (id: string) => http.delete(`/admin/daily-tasks/${id}`).then(() => undefined),
  /** The learners who completed tasks over a year, a month or a week (the one that holds `date`). */
  completionsOverTime: (range: ChartRange, date: string) =>
    http.get<TaskCompletionsChartData>('/admin/daily-tasks/completions-over-time', { params: { range, date } }).then((r) => r.data),
  getSettings: () => http.get<DailyTaskSettings>('/admin/daily-tasks/settings').then((r) => r.data),
  updateSettings: (settings: DailyTaskSettings) =>
    http.put<DailyTaskSettings>('/admin/daily-tasks/settings', settings).then((r) => r.data),
};

/** The plays of the minigames, which the daily task `minigames` counts (SCRUM-300). */
export const minigamePlaysApi = {
  /** `POST /api/minigames/plays`: a minigame starts; answers the id of its play. */
  start: (game: MinigameKind) => http.post<{ id: string }>('/minigames/plays', { game }).then((r) => r.data),
  /** `POST /api/minigames/plays/:id/finish`: the minigame ended; `counted` is false when it ran too short. */
  finish: (id: string) => http.post<{ counted: boolean }>(`/minigames/plays/${id}/finish`).then((r) => r.data),
};
