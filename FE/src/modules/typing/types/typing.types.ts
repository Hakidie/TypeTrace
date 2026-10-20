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
