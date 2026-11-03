// The replay of a completed typing session (SCRUM-35): every change of the text the learner saw while typing, with its
// time, so the result page can play the typing back. Kept apart from the session, so the history and the stats never read
// it, and deleted by MongoDB 30 days after it was saved (TTL index); the session itself stays.
import mongoose, { Schema, Types } from 'mongoose';

/** How long a replay is kept. MongoDB's TTL monitor runs every minute, so it is deleted a little after this. */
export const REPLAY_TTL_DAYS = 30;
export const REPLAY_TTL_MS = REPLAY_TTL_DAYS * 24 * 60 * 60 * 1000;

/** The most a replay may take as JSON (UTF-8 bytes); the page records less (`MAX_REPLAY_BYTES` in the frontend). */
export const MAX_REPLAY_BYTES = 64 * 1024;

/**
 * One change of the text the learner saw: [ms since the previous change (the first one: since the first key), where it
 * starts, how many characters it removes there, the text it puts there]. A fifth item, 1, marks a change that is not
 * committed: the input method is still composing it (or nothing changed: the end of the session), so the words graded
 * so far stay as they were. Otherwise the text after the change is committed: its finished words are graded.
 */
export type ReplayEvent = [number, number, number, string] | [number, number, number, string, 1];

export interface SessionReplayDocument extends mongoose.Document {
  owner: Types.ObjectId;
  session: Types.ObjectId;
  events: ReplayEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const sessionReplaySchema = new Schema<SessionReplayDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // One replay per session: it is saved once, by the request that completes the session.
    session: { type: Schema.Types.ObjectId, ref: 'TypingSession', required: true, unique: true },
    // Checked by the validator (`replaySchema`), stored as sent and never changed afterwards.
    events: { type: Schema.Types.Mixed, required: true }
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

sessionReplaySchema.index({ createdAt: 1 }, { expireAfterSeconds: REPLAY_TTL_MS / 1000 });

export const SessionReplayModel = mongoose.model<SessionReplayDocument>('SessionReplay', sessionReplaySchema);
