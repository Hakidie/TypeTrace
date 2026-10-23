import { http } from '@/shared/api/http';
import type { Paginated } from '@/shared/api/types';
import type { PassageOption, SessionMode, StartSessionInput, TypingSession } from '../types/typing.types';

/** The passage menu shows one page of the list, as big as the backend allows (sorted by title). */
const PASSAGE_MENU_LIMIT = 100;

/** Every function resolves with the response body (not the Axios response). */
export const typingApi = {
  start: (input: StartSessionInput = {}) => http.post<TypingSession>('/sessions', input).then((r) => r.data),
  get: (id: string) => http.get<TypingSession>(`/sessions/${id}`).then((r) => r.data),
  /** The learner pressed the first key: the server starts the clock. */
  begin: (id: string) => http.patch<TypingSession>(`/sessions/${id}/begin`).then((r) => r.data),
  /** Sends only the typed words: the server grades them and measures the time itself. */
  complete: (id: string, typedWords: string[]) =>
    http.patch<TypingSession>(`/sessions/${id}/complete`, { typedWords }).then((r) => r.data),
  /** The passages the learner can choose for a mode (published, public, and their own in practice). */
  passages: (mode: SessionMode) =>
    http
      .get<Paginated<PassageOption>>('/passages', { params: { mode, limit: PASSAGE_MENU_LIMIT } })
      .then((r) => r.data.items),
  abandon: (id: string) => http.patch<TypingSession>(`/sessions/${id}/abandon`).then((r) => r.data),
};
