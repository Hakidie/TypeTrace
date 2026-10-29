import { http } from '@/shared/api/http';
import type { TypingSession } from '@/modules/typing/types/typing.types';
import type { DailyBoard, DailyDay, DailyDayResult, DailyToday } from '../types/daily.types';

/** Every function resolves with the response body. A try is finished with the typing session API (`typingApi.complete`). */
export const dailyApi = {
  today: () => http.get<DailyToday>('/daily').then((r) => r.data),
  leaderboard: (day: DailyDay) => http.get<DailyBoard>('/daily/leaderboard', { params: { day } }).then((r) => r.data),
  startTry: () => http.post<TypingSession>('/daily/sessions').then((r) => r.data),
  history: () => http.get<{ days: DailyDayResult[] }>('/daily/history').then((r) => r.data.days),
};
