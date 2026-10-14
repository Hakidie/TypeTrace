import type { WordErrorType } from '@/shared/lib/vietnamese-errors';

export const errorLabels: Record<WordErrorType, string> = {
  BASE_LETTER: 'Wrong letter',
  D_MISSING: 'Missing stroke on đ',
  MARK_WRONG: 'Wrong vowel mark (â ê ô ă ơ ư)',
  TONE_WRONG: 'Wrong tone',
  HOI_NGA_CONFUSION: 'Hỏi / ngã confusion',
};
