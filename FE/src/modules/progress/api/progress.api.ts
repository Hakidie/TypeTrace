import { http } from '@/shared/api/http';
import type { VowelToneGridData } from '../types/progress.types';

export const progressApi = {
  getVowelTone: () => http.get<VowelToneGridData>('/profile/vowel-tone').then((r) => r.data),
};
