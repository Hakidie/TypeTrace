import type { CurrentUser } from '@/modules/auth/types/auth.types';
import { http } from '@/shared/api/http';
import type { CoachStats, TutorialMode, TutorialStatus } from '../types/tutorial.types';

export type TutorialUpdate = { mode?: TutorialMode; status?: TutorialStatus; tour?: 'done' | 'skipped' };

/** Every function resolves with the response body; the state calls answer the signed-in user. */
export const tutorialApi = {
  start: () => http.post<CurrentUser>('/tutorial/start').then((r) => r.data),
  update: (body: TutorialUpdate) => http.patch<CurrentUser>('/tutorial', body).then((r) => r.data),
  reset: () => http.post<CurrentUser>('/tutorial/reset').then((r) => r.data),
  coach: (stats: CoachStats) => http.post<{ tip: string; ai: boolean }>('/tutorial/coach', stats).then((r) => r.data),
};
