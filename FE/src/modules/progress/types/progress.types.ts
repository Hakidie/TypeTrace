import type { ChartRange } from '@/modules/profile/types/profile.types';
import type { SessionErrorType, TypingLanguage } from '@/shared/lib/typing-language';
import type { ToneId, Vowel } from '../lib/vowel-tone';

/** One cell of the vowel × tone grid (`GET /api/profile/vowel-tone`, SCRUM-29). */
export interface VowelToneCell {
  vowel: Vowel;
  tone: ToneId;
  /** How often the vowel was in a target word of that tone. */
  seen: number;
  /** How often the word was typed wrong at that vowel or tone. */
  wrong: number;
  /** Up to 3 different words typed wrong, the newest first. */
  examples: { target: string; typed: string }[];
}

export interface VowelToneGridData {
  language: 'vi';
  /** Counted sessions read at most. */
  window: number;
  /** A cell seen fewer times than this is grey: the backend's threshold, never written in the frontend. */
  minSeen: number;
  /** Sessions read: 0 to `window`. */
  sessionsUsed: number;
  cells: VowelToneCell[];
}

/** One column of the error rate chart (`GET /api/profile/error-trend`, SCRUM-30). */
export interface ErrorTrendPoint {
  /** The period: 'YYYY-MM' (`year`), the first day of the block 'YYYY-MM-DD' (`month`) or the day 'YYYY-MM-DD' (`week`). */
  key: string;
  /** The error rate in % of each type; `null` where the period gave no chance of it (a gap, never 0). */
  rates: Partial<Record<SessionErrorType, number | null>>;
}

export interface ErrorTrend {
  range: ChartRange;
  language: TypingLanguage;
  types: SessionErrorType[];
  points: ErrorTrendPoint[];
}
