// One play of a minigame of the Typing page's Minigames tab (SCRUM-300): the server opens it when the game starts and closes
// it when it ends, and counts it for the daily task `minigames` only after the game's minimum time (config/minigames.ts).
// Ranked duels are not stored here: their `Match` rows already say who finished them (minigame-times.service.ts).
import mongoose, { Schema, Types } from 'mongoose';

export const MINIGAMES = ['chain', 'rain', 'bot'] as const;
export type Minigame = (typeof MINIGAMES)[number];

export interface MinigamePlayDocument extends mongoose.Document {
  owner: Types.ObjectId;
  game: Minigame;
  /** The server's clock when the game started. */
  startedAt: Date;
  /** `false` until the game ends. A boolean, because a partial index cannot test for a missing `finishedAt`. */
  finished: boolean;
  /** The server's clock when the game ended; set with `finished`. */
  finishedAt?: Date;
}

/** An open play that nobody finished is deleted this long after it started (the game was left or the page was closed). */
export const OPEN_PLAY_TTL_SECONDS = 24 * 60 * 60;

const minigamePlaySchema = new Schema<MinigamePlayDocument>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  game: { type: String, enum: MINIGAMES, required: true },
  startedAt: { type: Date, required: true },
  finished: { type: Boolean, default: false },
  finishedAt: Date
});

// The daily task reads the plays one learner finished in a window of time.
minigamePlaySchema.index({ owner: 1, finishedAt: 1 });
minigamePlaySchema.index(
  { startedAt: 1 },
  { expireAfterSeconds: OPEN_PLAY_TTL_SECONDS, partialFilterExpression: { finished: false } }
);

export const MinigamePlayModel = mongoose.model<MinigamePlayDocument>('MinigamePlay', minigamePlaySchema);
