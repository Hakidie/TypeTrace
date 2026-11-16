import { CalendarDays, ClipboardCheck, Dumbbell, Keyboard, type LucideIcon } from 'lucide-react';
import { translatedRecord } from '@/shared/i18n/translated-record';
import type { SessionErrorType, TypingLanguage } from '@/shared/lib/typing-language';
import type { SessionMode } from './types/typing.types';

/** The names of the error types of both sets: a session shows the ones of its language (SCRUM-219). */
const ERROR_TYPES: SessionErrorType[] = [
  'BASE_LETTER',
  'D_MISSING',
  'MARK_WRONG',
  'TONE_WRONG',
  'HOI_NGA_CONFUSION',
  'LETTER_WRONG',
  'LETTER_MISSING',
  'LETTER_EXTRA',
  'LETTERS_SWAPPED',
  'CASE_WRONG',
  'PUNCTUATION_WRONG',
];

export const errorLabels: Record<SessionErrorType, string> = translatedRecord(ERROR_TYPES, (type) => `typing:errors.${type}`);

/** The languages a learner types in (SCRUM-219): the short code of the switch on the Typing page and of the session cards. */
export const languageCodes: Record<TypingLanguage, string> = { vi: 'VI', en: 'EN' };

/** The same, in words: on the result page and in the hints of the profile. */
export const languageNames: Record<TypingLanguage, string> = translatedRecord(['vi', 'en'], (language) => `typing:languageNames.${language}`);

/** The names of the typing modes, as on the Typing page tabs. */
export const modeLabels: Record<SessionMode, string> = translatedRecord(['practice', 'placement', 'daily', 'targeted'], (mode) => `typing:modes.${mode}`);

/** The icons of the typing modes: on the Typing page tabs and on the session cards of the profile page. */
export const modeIcons: Record<SessionMode, LucideIcon> = {
  practice: Keyboard,
  placement: ClipboardCheck,
  daily: CalendarDays,
  targeted: Dumbbell,
};

/** "30s", "2m": the way the Typing page names its time choices. */
export const formatTimeLimit = (seconds: number) => (seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`);

/** Short names of the error types of both sets, for the chart axis, in the language of the interface. */
export const errorChartLabels: Record<SessionErrorType, string> = translatedRecord(ERROR_TYPES, (type) => `typing:errorChart.${type}`);

/** The Weak spots auto lesson trains the learner's weakest error types, at most this many (`LESSON_FOCUS_TYPES` in the backend). */
export const WEAK_SPOTS_FOCUS_TYPES = 2;

/** A session lasts at most 3 minutes (the server enforces it too: `MAX_SESSION_MS` in the backend). */
export const SESSION_TIME_LIMIT_SECONDS = 180;

/** The most a replay may take as JSON (UTF-8 bytes): a bigger one is not sent (the same as `MAX_REPLAY_BYTES` in the backend). */
export const MAX_REPLAY_BYTES = 64 * 1024;

/** How long the server keeps a replay (`REPLAY_TTL_DAYS` in the backend). */
export const REPLAY_KEPT_DAYS = 30;

/** The time choices of Practice (and of a guest's Practice and Rain): the button next to them switches between seconds and minutes. */
export type TimeUnit = 'sec' | 'min';
export const timeChoices: Record<TimeUnit, number[]> = { sec: [10, 20, 30], min: [1, 2, 3] };
export const unitLabels: Record<TimeUnit, string> = translatedRecord(['sec', 'min'], (unit) => `typing:units.${unit}`);
