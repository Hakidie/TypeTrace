// The daily challenge: one passage a day for everyone (`DailyChallenge`) and each learner's day (`DailyEntry`).
import mongoose, { Schema, Types } from 'mongoose';

/** The passage of one day (Vietnam time), copied when the day starts so editing the bank does not change it. */
export interface DailyChallengeDocument extends mongoose.Document {
  /** `YYYY-MM-DD`, see `dayKey`. */
  date: string;
  passageId: string;
  passageTitle: string;
  words: string[];
}

/** The last try of the day, for the result screen. */
export interface DailyTry {
  score: number;
  wpm: number;
  accuracy: number;
  counted: boolean;
  newBest: boolean;
  coins: number;
}

/** One learner on one day: tries used, best counted try, streak and coins of that day. */
export interface DailyEntryDocument extends mongoose.Document {
  user: Types.ObjectId;
  date: string;
  tries: number;
  /** The day has a counted try: it keeps the streak and gave its coins. */
  counted: boolean;
  bestScore: number;
  bestWpm: number;
  bestAccuracy: number;
  bestAt?: Date;
  streak: number;
  coins: number;
  lastTry?: DailyTry;
}

const dailyChallengeSchema = new Schema<DailyChallengeDocument>({
  date: { type: String, required: true, unique: true },
  passageId: { type: String, required: true },
  passageTitle: { type: String, required: true },
  words: { type: [String], required: true }
});

const dailyTrySchema = new Schema<DailyTry>(
  { score: Number, wpm: Number, accuracy: Number, counted: Boolean, newBest: Boolean, coins: Number },
  { _id: false }
);

const dailyEntrySchema = new Schema<DailyEntryDocument>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  tries: { type: Number, default: 0 },
  counted: { type: Boolean, default: false },
  bestScore: { type: Number, default: 0 },
  bestWpm: { type: Number, default: 0 },
  bestAccuracy: { type: Number, default: 0 },
  bestAt: Date,
  streak: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  lastTry: dailyTrySchema
});

dailyEntrySchema.index({ user: 1, date: 1 }, { unique: true });
// The board of a day: best score first, the one who got there first on a tie.
dailyEntrySchema.index({ date: 1, bestScore: -1, bestAt: 1 });

export const DailyChallengeModel = mongoose.model<DailyChallengeDocument>('DailyChallenge', dailyChallengeSchema);
export const DailyEntryModel = mongoose.model<DailyEntryDocument>('DailyEntry', dailyEntrySchema);
