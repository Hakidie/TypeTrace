import type { WordErrorType } from '@/shared/lib/vietnamese-errors';

/** `daily` sessions are old tries of the removed daily challenge: they still show in the history. */
export type SessionMode = 'practice' | 'placement' | 'daily';
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
  /** The time the learner chose with the first key, in seconds, kept by the server (US10.1); sessions from before have none. */
  chosenLimitSeconds?: number;
  /** Whether the placement session went on the placement leaderboard: the server decides when it is completed (US10.1). */
  isOnPlacementBoard: boolean;
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

/**
 * One change of the text the learner saw while typing (SCRUM-35), as the typing area records it (`utils/session-replay.ts`):
 * [ms since the previous change (the first one: since the first key), where it starts, how many characters it removes
 * there, the text it puts there]. A fifth item, 1: the change is not committed (the input method is still composing it, or
 * nothing changed: the end of the session), so the graded words stay as they were. Mirrors `ReplayEvent` in
 * `BE/src/models/session-replay.model.ts`.
 */
export type ReplayEvent = [dt: number, at: number, removed: number, inserted: string] | [dt: number, at: number, removed: number, inserted: string, composing: 1];

/** `GET /sessions/:id/replay`: the replay of a completed session, kept 30 days after it was saved. */
export interface SessionReplay {
  session: string;
  events: ReplayEvent[];
  createdAt: string;
  /** When the server deletes it. */
  expiresAt: string;
}

export interface StartSessionInput {
  mode?: SessionMode;
  passageId?: string;
  /** The time the learner chose; a placement session needs it to be ranked (US10.1). */
  timeLimitSeconds?: number;
}

/** One entry of the passage dropdown (`GET /api/passages`): no text. */
export interface PassageOption {
  _id: string;
  title: string;
  wordCount: number;
}
