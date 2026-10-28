import { tokenStore } from '@/modules/auth/store/token.store';
import { http } from '@/shared/api/http';
import { parseEvents } from '../lib/sse';
import type { MatchEvent, ProgressInput, ProgressUpdate, PublicMatch } from '../types/ranked.types';

/** Every function resolves with the response body (not the Axios response). */
export const rankedApi = {
  create: () => http.post<PublicMatch>('/matches').then((r) => r.data),
  join: (code: string) => http.post<PublicMatch>(`/matches/${code}/join`).then((r) => r.data),
  get: (code: string) => http.get<PublicMatch>(`/matches/${code}`).then((r) => r.data),
  leave: (code: string) => http.post<PublicMatch>(`/matches/${code}/leave`).then((r) => r.data),
  ready: (code: string, ready: boolean) => http.post<PublicMatch>(`/matches/${code}/ready`, { ready }).then((r) => r.data),
  progress: (code: string, input: ProgressInput) => http.post<ProgressUpdate>(`/matches/${code}/progress`, input).then((r) => r.data),
  rematch: (code: string) => http.post<PublicMatch>(`/matches/${code}/rematch`).then((r) => r.data),
};

const RECONNECT_MS = 1000;

/**
 * Listens to the events of a room. Axios cannot read a stream, so this is the one place that uses `fetch`: with the
 * `Authorization` header, never a token in the URL (an `EventSource` cannot send headers). A dropped stream (a network
 * hiccup, a server restart) reconnects after a second; a 404 or 401 stops it and calls `onGone`. Returns the function
 * that closes it.
 */
export const openMatchStream = (code: string, onEvent: (event: MatchEvent) => void, { onGone }: { onGone?: () => void } = {}) => {
  const controller = new AbortController();
  let closed = false;

  const connect = async () => {
    try {
      const response = await fetch(`${http.defaults.baseURL}/matches/${code}/events`, {
        headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (response.status === 404 || response.status === 401) {
        onGone?.();
        return;
      }
      if (!response.ok || !response.body) throw new Error(`Stream answered ${response.status}`);
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
    if (!closed) setTimeout(() => !closed && void connect(), RECONNECT_MS);
  };

  void connect();
  return () => {
    closed = true;
    controller.abort();
  };
};
