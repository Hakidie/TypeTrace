import { http } from '@/shared/api/http';
import type { Paginated } from '@/shared/api/types';
import type {
  PassageOption,
  ReplayEvent,
  SessionMode,
  SessionReplay,
  SessionStats,
  StartSessionInput,
  TypingSession,
} from '../types/typing.types';

/** The passage menu shows one page of the list, as big as the backend allows (sorted by title). */
const PASSAGE_MENU_LIMIT = 100;

/** Every function resolves with the response body (not the Axios response). */
export const typingApi = {
  start: (input: StartSessionInput = {}) => http.post<TypingSession>('/sessions', input).then((r) => r.data),
  get: (id: string) => http.get<TypingSession>(`/sessions/${id}`).then((r) => r.data),
  /** Right and wrong words and the error rate per type of a completed session (owner only). */
  stats: (id: string) => http.get<SessionStats>(`/sessions/${id}/stats`).then((r) => r.data),
  /** The learner pressed the first key: the server starts the clock. */
  begin: (id: string) => http.patch<TypingSession>(`/sessions/${id}/begin`).then((r) => r.data),
  /**
   * Sends the typed words, when each was finished, the time the learner chose (for the chart) and the replay (SCRUM-35, kept
   * apart for 30 days): the server grades the words and measures the time itself.
   */
  complete: (id: string, typedWords: string[], typedAtMs: number[], timeLimitSeconds: number, replay?: ReplayEvent[]) =>
    http.patch<TypingSession>(`/sessions/${id}/complete`, { typedWords, typedAtMs, timeLimitSeconds, replay }).then((r) => r.data),
  /** The replay of a completed session (owner only); 404 when it has none: older than 30 days, or saved without one. */
  replay: (id: string) => http.get<SessionReplay>(`/sessions/${id}/replay`).then((r) => r.data),
  /** The passages the learner can choose for a mode (published, public, and their own in practice). */
  passages: (mode: SessionMode) =>
    http
      .get<Paginated<PassageOption>>('/passages', { params: { mode, limit: PASSAGE_MENU_LIMIT } })
      .then((r) => r.data.items),
  abandon: (id: string) => http.patch<TypingSession>(`/sessions/${id}/abandon`).then((r) => r.data),
};
