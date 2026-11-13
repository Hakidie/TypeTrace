import type { SessionErrorType, TypingLanguage } from '@/shared/lib/typing-language';
import type { WordErrorType } from '@/shared/lib/vietnamese-errors';

/**
 * `daily` sessions are old tries of the removed daily challenge: they still show in the history. `targeted` is Weak spots
 * (SCRUM-28, US3.2): a lesson of words picked by the server for the learner's errors.
 */
export type SessionMode = 'practice' | 'placement' | 'daily' | 'targeted';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

/** How many times each error type happened (or could have happened): the types of the session's language only (SCRUM-219). */
export type ErrorCounts = Partial<Record<SessionErrorType, number>>;

/** One graded word. Mirrors `SessionWord` in `BE/src/models/typing-session.model.ts`. */
export interface SessionWord {
  index: number;
  target: string;
  typed: string;
  /** Empty when the word is correct. The types of the session's language. */
  errorTypes: SessionErrorType[];
  /** Milliseconds from the first key to the end of this word; missing on sessions from before it was stored. */
  typedAtMs?: number;
}

/** Mirrors `TypingSessionDocument` in the backend. Results exist once the session is completed. */
export interface TypingSession {
  _id: string;
  owner: string;
  mode: SessionMode;
  /**
   * What the learner typed in (SCRUM-219): their Practice language, always `vi` in the placement test and in Weak spots. It
   * picks the error set.
   */
  language?: TypingLanguage;
  /** Missing on a Weak spots lesson, which types words of the word bank, not a passage. */
  passageId?: string;
  /** Title of the passage (or of the Weak spots lesson); missing on sessions from before it was stored. */
  passageTitle?: string;
  targetWords: string[];
  /**
   * Weak spots only: the error types the lesson trains, the highest error rate first. Empty when there was nothing to aim at
   * (no type with enough data in the error profile yet, or no word for the type chosen) and the session types a random passage
   * instead.
   */
  focusErrorTypes?: WordErrorType[];
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
  errorTypes: { type: SessionErrorType; errors: number; opportunities: number; rate: number }[];
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
  /** Weak spots only: the one error type to practice. Missing = the learner's types with the highest error rates. */
  errorType?: WordErrorType;
}

/** One entry of the passage dropdown (`GET /api/passages`): no text. */
/** Who made a passage (SCRUM-304): TypeTrace's (`system`), the learner's own (`mine`) or another learner's public one (`others`). */
export type PassageOrigin = 'system' | 'mine' | 'others';

/** What the passage menus can be sorted by: newest first, by name, by number of words. */
export type PassageMenuSort = '-createdAt' | 'title' | 'wordCount';

/** What a passage menu asks of `GET /api/passages` besides the mode and language: text in the title, sort, who made it. */
export interface PassageMenuQuery {
  q?: string;
  sort?: PassageMenuSort;
  origin?: PassageOrigin;
}

export interface PassageOption {
  _id: string;
  title: string;
  wordCount: number;
  /** TypeTrace's own passage (no owner, an admin, or an account that was deleted): the menu tags it "System". */
  isSystem: boolean;
  /** One of the learner's own passages. */
  isOwn: boolean;
  /** The public name of the author, never an email. */
  ownerName: string;
  /** One of the learner's own passages past the limit of their plan (US11.1): shown, but it cannot be picked. */
  locked?: boolean;
  /** Another learner's public passage on a plan that may not practice it (US11.1): picking it opens the plan. */
  lockedByPlan?: boolean;
}
