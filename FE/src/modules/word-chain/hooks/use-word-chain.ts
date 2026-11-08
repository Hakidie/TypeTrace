import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wordChainApi, type BoardRange } from '../api/word-chain.api';
import { parseWordList } from '../lib/word-chain';

export const wordChainKeys = {
  words: ['word-chain', 'words'] as const,
  boards: ['word-chain', 'board'] as const,
  board: (range: BoardRange) => [...wordChainKeys.boards, range] as const,
};

/** The word list of Nối từ, read once and kept for the whole visit (it never changes while the app runs). */
export const useWordBank = () =>
  useQuery({
    queryKey: wordChainKeys.words,
    queryFn: async () => parseWordList(await wordChainApi.words()),
    staleTime: Infinity,
    gcTime: Infinity,
  });

/** The leaderboard of this week or of all the time. */
export const useWordChainBoard = (range: BoardRange) =>
  useQuery({
    queryKey: wordChainKeys.board(range),
    queryFn: () => wordChainApi.board(range),
  });

/** Sends a finished game; both boards are asked for again. */
export const useSaveWordChainScore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: wordChainApi.saveScore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wordChainKeys.boards }),
  });
};
