import { tokenStore } from '@/modules/auth/store/token.store';
import { http } from '@/shared/api/http';
import { parseEvents } from '../lib/sse';
import type { Leaderboard, MatchEvent, MatchKind, Paginated, ProgressInput, ProgressUpdate, PublicMatch, RankedMe, Season } from '../types/ranked.types';

/** Every function resolves with the response body (not the Axios response). */
export const rankedApi = {
  create: (kind: MatchKind) => http.post<PublicMatch>('/matches', { kind }).then((r) => r.data),
  join: (code: string) => http.post<PublicMatch>(`/matches/${code}/join`).then((r) => r.data),
  get: (code: string) => http.get<PublicMatch>(`/matches/${code}`).then((r) => r.data),
  leave: (code: string) => http.post<PublicMatch>(`/matches/${code}/leave`).then((r) => r.data),
  ready: (code: string, ready: boolean) => http.post<PublicMatch>(`/matches/${code}/ready`, { ready }).then((r) => r.data),
  progress: (code: string, input: ProgressInput) => http.post<ProgressUpdate>(`/matches/${code}/progress`, input).then((r) => r.data),
  rematch: (code: string) => http.post<PublicMatch>(`/matches/${code}/rematch`).then((r) => r.data),
  /** A word typed in a rain duel (on space or Enter); the server says whether it hit. */
  sendRainWord: (code: string, text: string) => http.post<{ hit: boolean }>(`/matches/${code}/rain`, { text }).then((r) => r.data),
  me: (kind: MatchKind) => http.get<RankedMe>('/ranked/me', { params: { kind } }).then((r) => r.data),
  leaderboard: (params: { page: number; limit: number; kind: MatchKind }) => http.get<Leaderboard>('/ranked/leaderboard', { params }).then((r) => r.data),
  // Admin only.
  seasons: (params: { page: number; limit: number }) => http.get<Paginated<Season>>('/admin/seasons', { params }).then((r) => r.data),
  closeSeason: (id: string) => http.post<Season>(`/admin/seasons/${id}/close`).then((r) => r.data),
};

const RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30_000;

/**
 * Listens to the events of a room. Axios cannot read a stream, so this is the one place that uses `fetch`: with the
 * `Authorization` header, never a token in the URL (an `EventSource` cannot send headers). A dropped stream (a network
 * hiccup, a server restart, 429 or 5xx) reconnects after a second, waiting twice as long after each failed try (at most
 * 30 s); any other 4xx (no such room, not a player, signed out) stops it and calls `onGone`. Returns the function that
 * closes it.
 */
export const openMatchStream = (code: string, onEvent: (event: MatchEvent) => void, { onGone }: { onGone?: () => void } = {}) => {
  const controller = new AbortController();
  let closed = false;
  let delay = RECONNECT_MS;

  const connect = async () => {
    try {
      const response = await fetch(`${http.defaults.baseURL}/matches/${code}/events`, {
        headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        onGone?.();
        return;
      }
      if (!response.ok || !response.body) throw new Error(`Stream answered ${response.status}`);
      delay = RECONNECT_MS;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseEvents(buffer + value);
        buffer = parsed.rest;
        parsed.events.forEach((event) => onEvent(event as MatchEvent));
      }
    } catch {
      // Dropped or refused: tried again below unless closed.
    }
    if (closed) return;
    setTimeout(() => !closed && void connect(), delay);
    delay = Math.min(delay * 2, MAX_RECONNECT_MS);
  };

  void connect();
  return () => {
    closed = true;
    controller.abort();
  };
};
