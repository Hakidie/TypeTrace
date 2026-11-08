import { useQuery } from '@tanstack/react-query';
import { wordChainApi } from '../api/word-chain.api';
import { parseWordList } from '../lib/word-chain';

export const wordChainKeys = {
  words: ['word-chain', 'words'] as const,
};

/** The word list of Nối từ, read once and kept for the whole visit (it never changes while the app runs). */
export const useWordBank = () =>
  useQuery({
    queryKey: wordChainKeys.words,
    queryFn: async () => parseWordList(await wordChainApi.words()),
    staleTime: Infinity,
    gcTime: Infinity,
  });
