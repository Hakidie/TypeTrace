import { http } from '@/shared/api/http';
import type { AvatarLook } from '@/modules/avatar/types/avatar.types';

export type BoardRange = 'week' | 'all';

export interface WordChainBoard {
  range: BoardRange;
  items: {
    rank: number;
    displayName: string;
    avatar: AvatarLook;
    score: number;
    isMe: boolean;
  }[];
  /** The player's own place, also when they are under the top 20; null without a game. */
  me: { rank: number; score: number } | null;
}

export const wordChainApi = {
  /**
   * The word list of Nối từ, a static file of the frontend (`FE/public/noi-tu/words.txt`, built by
   * `minigame-words/build-noi-tu.mjs`), so it is read from the page's own origin, not the API.
   */
  words: () =>
    http
      .get<string>('/noi-tu/words.txt', {
        baseURL: window.location.origin,
        responseType: 'text',
      })
      .then((r) => r.data),
  /** `POST /api/word-chain/scores`: the server checks the chain and works out the score itself. */
  saveScore: (chain: { by: 'bot' | 'me'; word: string }[]) => http.post<{ score: number }>('/word-chain/scores', { chain }).then((r) => r.data),
  /** `GET /api/word-chain/leaderboard`: this week (from Monday in Vietnam) or all the time. */
  board: (range: BoardRange) => http.get<WordChainBoard>('/word-chain/leaderboard', { params: { range } }).then((r) => r.data),
};
