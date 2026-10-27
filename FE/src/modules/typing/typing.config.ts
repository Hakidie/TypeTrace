import type { WordErrorType } from '@/shared/lib/vietnamese-errors';
import type { SessionMode } from './types/typing.types';

export const errorLabels: Record<WordErrorType, string> = {
  BASE_LETTER: 'Wrong letter',
  D_MISSING: 'Missing stroke on đ',
  MARK_WRONG: 'Wrong vowel mark (â ê ô ă ơ ư)',
  TONE_WRONG: 'Wrong tone',
  HOI_NGA_CONFUSION: 'Hỏi / ngã confusion',
};

/** The names of the typing modes, as on the Typing page tabs. */
export const modeLabels: Record<SessionMode, string> = {
  practice: 'Practice',
  placement: 'Placement',
};

/** Short Vietnamese names of the error types, for the chart axis. */
export const errorChartLabels: Record<WordErrorType, string> = {
  BASE_LETTER: 'Sai chữ cái',
  D_MISSING: 'Thiếu nét đ',
  MARK_WRONG: 'Sai dấu mũ/móc',
  TONE_WRONG: 'Sai thanh điệu',
  HOI_NGA_CONFUSION: 'Nhầm hỏi/ngã',
};

/** A session lasts at most 3 minutes (the server enforces it too: `MAX_SESSION_MS` in the backend). */
export const SESSION_TIME_LIMIT_SECONDS = 180;
