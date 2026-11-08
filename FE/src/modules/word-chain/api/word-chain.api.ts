import { http } from '@/shared/api/http';

export const wordChainApi = {
  /**
   * The word list of Nối từ, a static file of the frontend (`FE/public/noi-tu/words.txt`, built by
   * `minigame-words/build-noi-tu.mjs`), so it is read from the page's own origin, not the API.
   */
  words: () => http.get<string>('/noi-tu/words.txt', { baseURL: window.location.origin, responseType: 'text' }).then((r) => r.data),
};
