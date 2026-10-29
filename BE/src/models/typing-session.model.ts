// A typing session: one learner typing one passage. The server grades it, the client only sends what was typed.
import mongoose, { Schema, Types } from 'mongoose';
import { WordError, WordErrorType } from '../utils/vietnamese-errors';

/** `daily` sessions are only started by the daily challenge (`POST /api/daily/sessions`), never by `POST /api/sessions`. */
export const sessionModes = ['practice', 'placement', 'daily'] as const;
export const startableModes = ['practice', 'placement'] as const;
export const sessionStatuses = ['in_progress', 'completed', 'abandoned'] as const;

export type SessionMode = (typeof sessionModes)[number];
export type StartableMode = (typeof startableModes)[number];
export type SessionStatus = (typeof sessionStatuses)[number];

/** How many times each error type happened (or could have happened). */
export type ErrorCounts = Record<WordErrorType, number>;

export interface SessionWord {
  index: number;
  target: string;
  typed: string;
  /** Empty when the word is correct. */
  errorTypes: WordErrorType[];
  /** Milliseconds from the first key to the moment the learner finished this word (SCRUM-187); sessions from before have none. */
  typedAtMs?: number;
}

export interface TypingSessionDocument extends mongoose.Document {
  owner: Types.ObjectId;
  mode: SessionMode;
  passageId: string;
  /** Copy of the passage title taken when the session started (sessions from before this field have none). */
  passageTitle?: string;
  /** The day of the daily challenge this try belongs to (`daily` sessions only), so a try finished after midnight counts for its own day. */
  dailyDate?: string;
  /** Copy of the passage words taken when the session started. */
  targetWords: string[];
  status: SessionStatus;
  words: SessionWord[];
  startedAt: Date;
  /** When the learner pressed the first key. The speed is measured from here (from `startedAt` if never set). */
  beganAt?: Date;
  /** The time the learner chose for the session, in seconds (the end of the time axis of the speed chart); sessions from before have none. */
  timeLimitSeconds?: number;
  completedAt?: Date;
  durationMs?: number;
  wpm?: number;
  accuracy?: number;
  errorCounts?: ErrorCounts;
  opportunityCounts?: ErrorCounts;
  /** Only counted sessions feed the learner's error profile (see `isSessionCounted`). */
  isCounted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const countsDefinition = Object.fromEntries(Object.values(WordError).map((type) => [type, { type: Number, default: 0 }]));
const countsSchema = new Schema(countsDefinition, { _id: false });

const wordSchema = new Schema(
  {
    index: { type: Number, required: true },
    target: { type: String, required: true },
    typed: { type: String, required: true },
    errorTypes: { type: [String], enum: Object.values(WordError), default: [] },
    typedAtMs: Number
  },
  { _id: false }
);

const typingSessionSchema = new Schema<TypingSessionDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, enum: sessionModes, default: 'practice' },
    passageId: { type: String, required: true },
    passageTitle: String,
    dailyDate: String,
    targetWords: { type: [String], required: true },
    status: { type: String, enum: sessionStatuses, default: 'in_progress' },
    words: { type: [wordSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    beganAt: Date,
    timeLimitSeconds: Number,
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
// One owner's sessions by completion time: the sessions of one of their days and their last counted sessions, which the
// daily tasks read at each counted session (SCRUM-112). Without it every completed session of the learner is read.
typingSessionSchema.index({ owner: 1, completedAt: -1 });

export const TypingSessionModel = mongoose.model<TypingSessionDocument>('TypingSession', typingSessionSchema);
