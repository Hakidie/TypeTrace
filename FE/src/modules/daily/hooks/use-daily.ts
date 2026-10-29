import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyApi } from '../api/daily.api';
import type { DailyDay } from '../types/daily.types';

/** Cache keys. Invalidating `dailyKeys.all` refreshes the card and the boards (after a try). */
export const dailyKeys = {
  all: ['daily'] as const,
  today: ['daily', 'today'] as const,
  board: (day: DailyDay) => ['daily', 'board', day] as const,
  history: ['daily', 'history'] as const,
};

/** The challenge card; asked again each time the tab opens (the day, tries and board change all the time). */
export const useDailyToday = () => useQuery({ queryKey: dailyKeys.today, queryFn: dailyApi.today, staleTime: 0 });

export const useDailyBoard = (day: DailyDay) => useQuery({ queryKey: dailyKeys.board(day), queryFn: () => dailyApi.leaderboard(day), staleTime: 0 });

/** Starts a try: a typing session on today's passage. Uses one of the day's tries, so the card is asked again. */
export const useStartTry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dailyApi.startTry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dailyKeys.today }),
  });
};

/** The learner's best try of each of the last 14 days, for the progress charts (asked again after each try with `dailyKeys.all`). */
export const useDailyHistory = () => useQuery({ queryKey: dailyKeys.history, queryFn: dailyApi.history, staleTime: 0 });
