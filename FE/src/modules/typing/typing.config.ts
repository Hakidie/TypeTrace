import type { WordErrorType } from '@/shared/lib/vietnamese-errors';

/** The passage to type. Words are separated by spaces; punctuation stays attached to its word. */
export const typingPassage =
  'Tiếng Việt rất đẹp. Người trường quốc khuỷu nghiêng hoà thuỷ text, xong. Hôm nay trời đẹp, chúng ta cùng đi chơi nhé.';

export const errorLabels: Record<WordErrorType, string> = {
  BASE_LETTER: 'Wrong letter',
  D_MISSING: 'Missing stroke on đ',
  MARK_WRONG: 'Wrong vowel mark (â ê ô ă ơ ư)',
  TONE_WRONG: 'Wrong tone',
  HOI_NGA_CONFUSION: 'Hỏi / ngã confusion',
};
