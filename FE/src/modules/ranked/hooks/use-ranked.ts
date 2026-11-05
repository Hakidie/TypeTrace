import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rankedApi } from '../api/ranked.api';
import { DEFAULT_PLACEMENT_MIN_ACCURACY } from '../lib/placement-board';
import type { MatchKind, PlacementRange } from '../types/ranked.types';

type PageParams = { page: number; limit: number };

/** Cache keys of the ratings (the matches have their own, `matchKeys`). `me()` without a kind covers both kinds. */
export const rankedKeys = {
  all: ['ranked'] as const,
  me: (kind?: MatchKind) => (kind ? ([...rankedKeys.all, 'me', kind] as const) : ([...rankedKeys.all, 'me'] as const)),
  leaderboard: (params: PageParams & { kind: MatchKind }) => [...rankedKeys.all, 'leaderboard', params] as const,
  placementBoard: (params: { passageId: string; range: PlacementRange }) => [...rankedKeys.all, 'placement-board', params] as const,
  placementSettings: () => [...rankedKeys.all, 'placement-settings'] as const,
  seasons: (params: PageParams) => [...rankedKeys.all, 'seasons', params] as const,
};

/** The own rating of one kind of match: each kind has its own rating, tier and board. */
export const useRankedMe = (kind: MatchKind) => useQuery({ queryKey: rankedKeys.me(kind), queryFn: () => rankedApi.me(kind) });

export const useLeaderboard = (params: PageParams & { kind: MatchKind }) =>
  useQuery({ queryKey: rankedKeys.leaderboard(params), queryFn: () => rankedApi.leaderboard(params), placeholderData: keepPreviousData });

/** The placement leaderboard of one passage (US10.1). */
export const usePlacementBoard = (params: { passageId: string; range: PlacementRange }) =>
  useQuery({ queryKey: rankedKeys.placementBoard(params), queryFn: () => rankedApi.placementBoard(params), placeholderData: keepPreviousData });

/** The settings of the placement leaderboard; the backend's default while they load (or when they cannot). */
export const usePlacementSettings = () => useQuery({ queryKey: rankedKeys.placementSettings(), queryFn: rankedApi.placementSettings });

/** The minimum accuracy in use, 90 until the settings arrive. */
export const usePlacementMinAccuracy = () => usePlacementSettings().data?.minAccuracy ?? DEFAULT_PLACEMENT_MIN_ACCURACY;

/** Admin: saves the minimum accuracy; the answer is the saved settings, so no new request. */
export const useUpdatePlacementSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rankedApi.updatePlacementSettings,
    onSuccess: (settings) => {
      toast.success('Placement settings saved.');
      queryClient.setQueryData(rankedKeys.placementSettings(), settings);
    },
  });
};

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
