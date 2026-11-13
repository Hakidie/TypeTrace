import { http } from '@/shared/api/http';
import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { TypingLanguage } from '@/shared/lib/typing-language';
import type { ErrorTrend, VowelToneGridData } from '../types/progress.types';

export const progressApi = {
  getErrorTrend: (range: ChartRange, language: TypingLanguage, date?: string) =>
    http.get<ErrorTrend>('/profile/error-trend', { params: { range, language, ...(date ? { date } : {}) } }).then((r) => r.data),
  getVowelTone: () => http.get<VowelToneGridData>('/profile/vowel-tone').then((r) => r.data),
};
