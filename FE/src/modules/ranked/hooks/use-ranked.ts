import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rankedApi } from '../api/ranked.api';

type PageParams = { page: number; limit: number };

/** Cache keys of the ratings (the matches have their own, `matchKeys`). */
export const rankedKeys = {
  all: ['ranked'] as const,
  me: () => [...rankedKeys.all, 'me'] as const,
  leaderboard: (params: PageParams) => [...rankedKeys.all, 'leaderboard', params] as const,
  seasons: (params: PageParams) => [...rankedKeys.all, 'seasons', params] as const,
};

export const useRankedMe = () => useQuery({ queryKey: rankedKeys.me(), queryFn: rankedApi.me });

export const useLeaderboard = (params: PageParams) =>
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
