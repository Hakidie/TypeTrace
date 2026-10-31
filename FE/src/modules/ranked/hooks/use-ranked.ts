import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rankedApi } from '../api/ranked.api';
import type { MatchKind } from '../types/ranked.types';

type PageParams = { page: number; limit: number };

/** Cache keys of the ratings (the matches have their own, `matchKeys`). `me()` without a kind covers both kinds. */
export const rankedKeys = {
  all: ['ranked'] as const,
  me: (kind?: MatchKind) => (kind ? ([...rankedKeys.all, 'me', kind] as const) : ([...rankedKeys.all, 'me'] as const)),
  leaderboard: (params: PageParams & { kind: MatchKind }) => [...rankedKeys.all, 'leaderboard', params] as const,
  seasons: (params: PageParams) => [...rankedKeys.all, 'seasons', params] as const,
};

/** The own rating of one kind of match: each kind has its own rating, tier and board. */
export const useRankedMe = (kind: MatchKind) => useQuery({ queryKey: rankedKeys.me(kind), queryFn: () => rankedApi.me(kind) });

export const useLeaderboard = (params: PageParams & { kind: MatchKind }) =>
  useQuery({ queryKey: rankedKeys.leaderboard(params), queryFn: () => rankedApi.leaderboard(params), placeholderData: keepPreviousData });

/** Admin. */
export const useSeasons = (params: PageParams) =>
  useQuery({ queryKey: rankedKeys.seasons(params), queryFn: () => rankedApi.seasons(params), placeholderData: keepPreviousData });

/** Admin: closing a season opens the next and resets every rating, so everything ranked is read again. */
export const useCloseSeason = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rankedApi.closeSeason(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rankedKeys.all }),
  });
};
