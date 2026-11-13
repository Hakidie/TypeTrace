import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import { progressApi } from '../api/progress.api';

export const progressKeys = {
  all: ['progress'] as const,
  errorTrend: (range: ChartRange, language: TypingLanguage, date?: string) => [...progressKeys.all, 'error-trend', range, language, date ?? ''] as const,
  vowelTone: () => [...progressKeys.all, 'vowel-tone'] as const,
};

/** The learner's vowel × tone grid (SCRUM-29). Asked again each time the page opens: a session can change it. */
export const useVowelTone = () => useQuery({ queryKey: progressKeys.vowelTone(), queryFn: progressApi.getVowelTone, staleTime: 0 });

/** The error rate of each error type over time (SCRUM-30), of one language. The last chart stays while another range or language loads. */
export const useErrorTrend = (range: ChartRange, language: TypingLanguage, date?: string) =>
  useQuery({
    queryKey: progressKeys.errorTrend(range, language, date),
    queryFn: () => progressApi.getErrorTrend(range, language, date),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
