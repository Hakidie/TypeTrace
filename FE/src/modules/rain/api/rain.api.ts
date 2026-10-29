import { http } from '@/shared/api/http';

/** `GET /api/rain/words`: the words of a round, half of them from the learner's weak error types (`focus`). */
export interface RainWords {
  words: string[];
  focus: string[];
}

export const rainApi = {
  words: () => http.get<RainWords>('/rain/words').then((r) => r.data),
};
