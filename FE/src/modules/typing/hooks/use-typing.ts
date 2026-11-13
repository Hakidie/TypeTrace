import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import { typingApi } from '../api/typing.api';
import type { PassageMenuQuery, ReplayEvent, SessionMode } from '../types/typing.types';

/** Cache keys. Invalidating `typingKeys.all` refreshes every typing query. */
export const typingKeys = {
  all: ['typing'] as const,
  passages: (mode: SessionMode, language: TypingLanguage = 'vi', query: PassageMenuQuery = {}) =>
    [...typingKeys.all, 'passages', mode, language, query] as const,
  detail: (id: string) => [...typingKeys.all, 'session', id] as const,
  replay: (id: string) => [...typingKeys.detail(id), 'replay'] as const,
};

export const useSession = (id: string) =>
  useQuery({ queryKey: typingKeys.detail(id), queryFn: () => typingApi.get(id) });

export const useSessionStats = (id: string) =>
  useQuery({ queryKey: [...typingKeys.detail(id), 'stats'], queryFn: () => typingApi.stats(id) });

/** The replay of a completed session (SCRUM-35). A saved replay never changes, so it is read once. */
export const useSessionReplay = (id: string) =>
  useQuery({ queryKey: typingKeys.replay(id), queryFn: () => typingApi.replay(id), staleTime: Infinity });

/**
 * The passages to choose from for a mode, in Practice the ones of `language` (SCRUM-219, Vietnamese by default). `enabled:
 * false` waits until the list is needed (the leaderboard reads it on its Placement tab only). `query` (SCRUM-304) is what the
 * passage menus add: a search, a sort, who made the passage; without it the list is the backend's default (by title).
 */
export const usePassageOptions = (
  mode: SessionMode,
  { enabled = true, language = 'vi', query = {} }: { enabled?: boolean; language?: TypingLanguage; query?: PassageMenuQuery } = {},
) =>
  useQuery({
    queryKey: typingKeys.passages(mode, language, query),
    queryFn: () => typingApi.passages(mode, language, query),
    enabled,
  });

// Mutations: no `onError` — the shared query client toasts the backend message.

/** Starts a session; the server abandons the one still in progress. */
export const useStartSession = () => useMutation({ mutationFn: typingApi.start });

/** Tells the server the first key was pressed, with the time chosen at that moment (the placement leaderboard only takes 3 minutes). */
export const useBeginSession = () =>
  useMutation({ mutationFn: (id: string) => typingApi.begin(id) });

interface CompleteInput {
  id: string;
  typedWords: string[];
  typedAtMs: number[];
  timeLimitSeconds: number;
  /** Missing when the typing area could not keep it (too big). */
  replay?: ReplayEvent[];
}

export const useCompleteSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, typedWords, typedAtMs, timeLimitSeconds, replay }: CompleteInput) =>
      typingApi.complete(id, typedWords, typedAtMs, timeLimitSeconds, replay),
    // The result page opens next: put the graded session in the cache so it does not need another request.
    onSuccess: (session) => queryClient.setQueryData(typingKeys.detail(session._id), session),
  });
};
