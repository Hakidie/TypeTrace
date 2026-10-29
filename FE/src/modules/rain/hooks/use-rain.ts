import { useQuery } from '@tanstack/react-query';
import { rainApi } from '../api/rain.api';

export const rainKeys = {
  words: ['rain', 'words'] as const,
};

/** The words for word rain, asked again each time the Rain tab opens (the weak error types change with each session). */
export const useRainWords = () => useQuery({ queryKey: rainKeys.words, queryFn: rainApi.words, staleTime: 0 });
