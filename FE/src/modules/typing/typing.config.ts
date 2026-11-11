import { CalendarDays, ClipboardCheck, Crosshair, Keyboard, type LucideIcon } from 'lucide-react';
import type { SessionErrorType, TypingLanguage } from '@/shared/lib/typing-language';
import type { SessionMode } from './types/typing.types';

/** The names of the error types of both sets: a session shows the ones of its language (SCRUM-219). */
export const errorLabels: Record<SessionErrorType, string> = {
  BASE_LETTER: 'Wrong letter',
  D_MISSING: 'Missing stroke on đ',
  MARK_WRONG: 'Wrong vowel mark (â ê ô ă ơ ư)',
  TONE_WRONG: 'Wrong tone',
  HOI_NGA_CONFUSION: 'Hỏi / ngã confusion',
  LETTER_WRONG: 'Wrong letter',
  LETTER_MISSING: 'Missing letter',
  LETTER_EXTRA: 'Extra letter',
  LETTERS_SWAPPED: 'Swapped letters',
  CASE_WRONG: 'Wrong case',
  PUNCTUATION_WRONG: 'Wrong punctuation',
};

/** The languages a learner types in (SCRUM-219): the short code of the switch on the Typing page and of the session cards. */
export const languageCodes: Record<TypingLanguage, string> = { vi: 'VI', en: 'EN' };

/** The same, in words: on the result page and in the hints of the profile. */
export const languageNames: Record<TypingLanguage, string> = { vi: 'Vietnamese', en: 'English' };

/** The names of the typing modes, as on the Typing page tabs. */
export const modeLabels: Record<SessionMode, string> = {
  practice: 'Practice',
  placement: 'Placement',
  daily: 'Daily',
  targeted: 'Weak spots',
};

/** The icons of the typing modes: on the Typing page tabs and on the session cards of the profile page. */
export const modeIcons: Record<SessionMode, LucideIcon> = {
  practice: Keyboard,
  placement: ClipboardCheck,
  daily: CalendarDays,
  targeted: Crosshair,
};

/** "30s", "2m": the way the Typing page names its time choices. */
export const formatTimeLimit = (seconds: number) => (seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`);

/** Short Vietnamese names of the error types of both sets, for the chart axis. */
export const errorChartLabels: Record<SessionErrorType, string> = {
  BASE_LETTER: 'Sai chữ cái',
  D_MISSING: 'Thiếu nét đ',
  MARK_WRONG: 'Sai dấu mũ/móc',
  TONE_WRONG: 'Sai thanh điệu',
  HOI_NGA_CONFUSION: 'Nhầm hỏi/ngã',
  LETTER_WRONG: 'Sai chữ cái',
  LETTER_MISSING: 'Thiếu chữ cái',
  LETTER_EXTRA: 'Thừa chữ cái',
  LETTERS_SWAPPED: 'Đảo chữ cái',
  CASE_WRONG: 'Sai hoa/thường',
  PUNCTUATION_WRONG: 'Sai dấu câu',
};

/** The Weak spots auto lesson trains the learner's weakest error types, at most this many (`LESSON_FOCUS_TYPES` in the backend). */
export const WEAK_SPOTS_FOCUS_TYPES = 2;

/** A session lasts at most 3 minutes (the server enforces it too: `MAX_SESSION_MS` in the backend). */
export const SESSION_TIME_LIMIT_SECONDS = 180;

/** The most a replay may take as JSON (UTF-8 bytes): a bigger one is not sent (the same as `MAX_REPLAY_BYTES` in the backend). */
export const MAX_REPLAY_BYTES = 64 * 1024;

/** How long the server keeps a replay (`REPLAY_TTL_DAYS` in the backend). */
export const REPLAY_KEPT_DAYS = 30;
