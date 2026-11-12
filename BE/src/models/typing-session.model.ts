// A typing session: one learner typing one passage. The server grades it, the client only sends what was typed.
import mongoose, { Schema, Types } from 'mongoose';
import { EnglishError } from '../utils/english-errors';
import { type SessionErrorType, type TypingLanguage, typingLanguages } from '../utils/typing-language';
import { WordError, WordErrorType } from '../utils/vietnamese-errors';

/**
 * `daily` sessions are old tries of the removed daily challenge: kept so they still read, never started again. `targeted` is
 * Weak spots (SCRUM-28, US3.2): a lesson of words of the word bank picked for the learner's errors, not a passage.
 */
export const sessionModes = ['practice', 'placement', 'daily', 'targeted'] as const;
export const startableModes = ['practice', 'placement', 'targeted'] as const;
/** The modes that type a passage of the bank, so the passage menu lists passages for them. */
export const passageModes = ['practice', 'placement'] as const;
export const sessionStatuses = ['in_progress', 'completed', 'abandoned'] as const;
/** The times the page offers (10, 20, 30 seconds and 1, 2, 3 minutes): the one a session is started with must be one of them. */
export const TIME_LIMIT_CHOICES_SECONDS = [10, 20, 30, 60, 120, 180] as const;

/** An abandoned session is deleted this long after it was abandoned. */
export const ABANDONED_TTL_MS = 24 * 60 * 60 * 1000;

export type SessionMode = (typeof sessionModes)[number];
export type StartableMode = (typeof startableModes)[number];
export type SessionStatus = (typeof sessionStatuses)[number];

/** How many times each Vietnamese error type happened (or could have happened). */
export type ErrorCounts = Record<WordErrorType, number>;

/**
 * The counts a session stores: every error type of its language (`errorTypesOf`), none of the other one (SCRUM-219). A
 * Vietnamese session's counts are `ErrorCounts`.
 */
export type SessionCounts = Partial<Record<SessionErrorType, number>>;

export interface SessionWord {
  index: number;
  target: string;
  typed: string;
  /** Empty when the word is correct. The types of the session's language. */
  errorTypes: SessionErrorType[];
  /** Milliseconds from the first key to the moment the learner finished this word (SCRUM-187); sessions from before have none. */
  typedAtMs?: number;
}

export interface TypingSessionDocument extends mongoose.Document {
  owner: Types.ObjectId;
  mode: SessionMode;
  /**
   * What the learner typed in (SCRUM-219): their language in Practice (`settings.typingLanguage`), always Vietnamese in the
   * placement test and in Weak spots, whose word bank is Vietnamese. It picks the error set that grades and counts the
   * session. Sessions saved before the field read `vi`.
   */
  language: TypingLanguage;
  /** The passage typed. A Weak spots lesson types words of the word bank and has none (US3.2). */
  passageId?: string;
  /** Copy of the passage title taken when the session started (sessions from before this field have none); a Weak spots lesson's own title. */
  passageTitle?: string;
  /** Copy of the passage words taken when the session started, or the words of a Weak spots lesson. */
  targetWords: string[];
  /**
   * Weak spots only (US3.2): the error types the lesson trains, the highest error rate first. Empty when there was nothing to
   * aim at (no type with enough data in the error profile yet, or no word for it) and the session types a random passage
   * instead, which the page tells the learner.
   */
  focusErrorTypes?: WordErrorType[];
  /**
   * Weak spots only: the words of the bank picked for the lesson. The AI writes its passage (`targetWords`) from them, and the
   * next lessons leave them out (US3.2). Lessons saved before the AI passages have none: their `targetWords` are the picked words.
   */
  lessonWords?: string[];
  /** Weak spots only: what is typed: the AI's passage (`ai`), the picked words as they are (`words`), or a random passage (`passage`). */
  lessonSource?: 'ai' | 'words' | 'passage';
  status: SessionStatus;
  words: SessionWord[];
  startedAt: Date;
  /** When the learner pressed the first key. The speed is measured from here (from `startedAt` if never set). */
  beganAt?: Date;
  /** The time the learner chose for the session, in seconds (the end of the time axis of the speed chart); sessions from before have none. */
  timeLimitSeconds?: number;
  /**
   * The time the learner chose when the session started (`POST /api/sessions`), kept by the server (US10.1): the page's `timeLimitSeconds`
   * sent at the end is never used to rank. Changing the time starts a new session. Sessions from before have none.
   */
  chosenLimitSeconds?: number;
  /** Set once by `completeSession` (`isSessionOnPlacementBoard`): only a placement session that passed the rules can be on the placement leaderboard. An admin changing the minimum accuracy sets it again (`rebuildPlacementBoardFlags`). */
  isOnPlacementBoard: boolean;
  completedAt?: Date;
  durationMs?: number;
  wpm?: number;
  accuracy?: number;
  errorCounts?: SessionCounts;
  opportunityCounts?: SessionCounts;
  /** Only counted sessions feed the learner's error profile (see `isSessionCounted`). */
  isCounted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Every error type of both sets: a session's words and counts hold the types of its language. */
const sessionErrorTypes = [...Object.values(WordError), ...Object.values(EnglishError)];

// The types of both languages, without defaults: `countErrors` writes every type of the session's language (0 included),
// so the other language's types stay out of the document.
const countsDefinition = Object.fromEntries(sessionErrorTypes.map((type) => [type, { type: Number }]));
const countsSchema = new Schema(countsDefinition, { _id: false });

const wordSchema = new Schema(
  {
    index: { type: Number, required: true },
    target: { type: String, required: true },
    typed: { type: String, required: true },
    errorTypes: { type: [String], enum: sessionErrorTypes, default: [] },
    typedAtMs: Number
  },
  { _id: false }
);

const typingSessionSchema = new Schema<TypingSessionDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, enum: sessionModes, default: 'practice' },
    language: { type: String, enum: typingLanguages, default: 'vi' },
    passageId: {
      type: String,
      required: function (this: { mode?: SessionMode }) {
        return this.mode !== 'targeted';
      }
    },
    passageTitle: String,
    targetWords: { type: [String], required: true },
    // No default: only Weak spots sessions have the field, so an empty list always means "nothing to aim at".
    focusErrorTypes: { type: [String], enum: Object.values(WordError), default: undefined },
    lessonWords: { type: [String], default: undefined },
    lessonSource: { type: String, enum: ['ai', 'words', 'passage'] },
    status: { type: String, enum: sessionStatuses, default: 'in_progress' },
    words: { type: [wordSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    beganAt: Date,
    timeLimitSeconds: Number,
    chosenLimitSeconds: Number,
    isOnPlacementBoard: { type: Boolean, default: false },
    completedAt: Date,
    durationMs: Number,
    wpm: Number,
    accuracy: Number,
    errorCounts: countsSchema,
    opportunityCounts: countsSchema,
    isCounted: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Matches the history list (one owner's sessions, newest first) and "find the session in progress".
typingSessionSchema.index({ owner: 1, createdAt: -1 });
typingSessionSchema.index({ owner: 1, status: 1 });
// One owner's sessions of one mode, newest first: the history filtered by mode, and the last Weak spots lessons, whose words a
// new lesson leaves out (US3.2). Without it the lessons are looked for among every session of the learner.
typingSessionSchema.index({ owner: 1, mode: 1, createdAt: -1 });
// One owner's sessions by completion time: the sessions of one of their days and their last counted sessions, which the
// daily tasks read at each counted session (SCRUM-112). Without it every completed session of the learner is read.
typingSessionSchema.index({ owner: 1, completedAt: -1 });

// The placement leaderboard (US10.1): the sessions of one passage that went on it, already in the order of the board (WPM, accuracy,
// time, who finished first), so the ranking reads them in order without sorting them in memory; a week only filters `completedAt`.
typingSessionSchema.index({ passageId: 1, isOnPlacementBoard: 1, wpm: -1, accuracy: -1, durationMs: 1, completedAt: 1 });

// Abandoned sessions (a time changed, a page left) are deleted 24 hours after they were abandoned: `updatedAt` is written when the status
// changes. Only abandoned ones are in this index, so completed sessions are never deleted.
typingSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: ABANDONED_TTL_MS / 1000, partialFilterExpression: { status: 'abandoned' } });

export const TypingSessionModel = mongoose.model<TypingSessionDocument>('TypingSession', typingSessionSchema);
