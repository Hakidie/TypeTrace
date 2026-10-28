// A player's Elo in one season (ranked duel design, phase 5). Made at the first rated match, or at the soft reset when the
// season before closes.
import mongoose, { Schema, Types } from 'mongoose';

export interface SeasonRatingDocument extends mongoose.Document {
  user: Types.ObjectId;
  season: Types.ObjectId;
  rating: number;
  /** The highest rating of the season: its tier decides the season rewards (phase 6). */
  peakRating: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  /** The tier rewards of the season were given (once, when it closed). */
  rewardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const seasonRatingSchema = new Schema<SeasonRatingDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    season: { type: Schema.Types.ObjectId, ref: 'Season', required: true },
    rating: { type: Number, required: true },
    peakRating: { type: Number, required: true },
    matches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    rewardedAt: Date
  },
  { timestamps: true }
);

seasonRatingSchema.index({ season: 1, user: 1 }, { unique: true });
// The leaderboard: the best ratings of a season.
seasonRatingSchema.index({ season: 1, rating: -1 });

export const SeasonRatingModel = mongoose.model<SeasonRatingDocument>('SeasonRating', seasonRatingSchema);
