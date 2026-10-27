import type { WordErrorType } from '@/shared/lib/vietnamese-errors';

export type SessionMode = 'practice' | 'placement';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

/** How many times each error type happened (or could have happened). */
export type ErrorCounts = Record<WordErrorType, number>;

/** One graded word. Mirrors `SessionWord` in `BE/src/models/typing-session.model.ts`. */
export interface SessionWord {
  index: number;
  target: string;
  typed: string;
  /** Empty when the word is correct. */
  errorTypes: WordErrorType[];
  /** Milliseconds from the first key to the end of this word; missing on sessions from before it was stored. */
  typedAtMs?: number;
}

/** Mirrors `TypingSessionDocument` in the backend. Results exist once the session is completed. */
export interface TypingSession {
  _id: string;
  owner: string;
  mode: SessionMode;
  passageId: string;
  /** Title of the passage; missing on sessions from before it was stored. */
  passageTitle?: string;
  targetWords: string[];
  status: SessionStatus;
  words: SessionWord[];
  startedAt: string;
  /** When the first key was pressed; the timer runs from here. */
  beganAt?: string;
  completedAt?: string;
  durationMs?: number;
  wpm?: number;
  accuracy?: number;
  errorCounts?: ErrorCounts;
  opportunityCounts?: ErrorCounts;
  isCounted: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `GET /sessions/:id/stats`: the numbers behind the result charts, worked out by the server. */
export interface SessionStats {
  totalWords: number;
  correctWords: number;
  wrongWords: number;
  /** Share of wrong words, 0-100. */
  wrongRate: number;
  /** Types that never had a chance in the passage are left out. */
  errorTypes: { type: WordErrorType; errors: number; opportunities: number; rate: number }[];
  isCounted: boolean;
  /** The time the learner chose, in seconds: the end of the time axis of the speed chart. */
  timeLimitSeconds: number;
  timeline: SessionTimeline;
}

/** WPM and number of errors in the last 10 seconds, at every second. `no_data`: older session without word times; `too_short`: under 10 seconds. */
export interface SessionTimeline {
  status: 'ok' | 'no_data' | 'too_short';
  points: { second: number; wpm: number; errors: number }[];
}

export interface StartSessionInput {
  mode?: SessionMode;
  passageId?: string;
}

/** One entry of the passage dropdown (`GET /api/passages`): no text. */
export interface PassageOption {
  _id: string;
  title: string;
  wordCount: number;
}
