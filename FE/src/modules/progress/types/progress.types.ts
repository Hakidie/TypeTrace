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
