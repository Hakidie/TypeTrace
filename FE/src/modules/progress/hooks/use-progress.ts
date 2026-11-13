import { useQuery } from '@tanstack/react-query';
import { progressApi } from '../api/progress.api';

export const progressKeys = {
  all: ['progress'] as const,
  vowelTone: () => [...progressKeys.all, 'vowel-tone'] as const,
};

/** The learner's vowel × tone grid (SCRUM-29). Asked again each time the page opens: a session can change it. */
export const useVowelTone = () => useQuery({ queryKey: progressKeys.vowelTone(), queryFn: progressApi.getVowelTone, staleTime: 0 });
