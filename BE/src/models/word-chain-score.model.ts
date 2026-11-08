// One finished game of Nối từ that went on the leaderboard: its score, worked out by the server from the chain.
import mongoose, { Schema, Types } from 'mongoose';

export interface WordChainScoreDocument extends mongoose.Document {
  user: Types.ObjectId;
  score: number;
  /** How many links the chain had (bot and player words). */
  links: number;
  createdAt: Date;
}

const wordChainScoreSchema = new Schema<WordChainScoreDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 0 },
    links: { type: Number, required: true, min: 1 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The boards read the games of a period, best first.
wordChainScoreSchema.index({ createdAt: -1 });
wordChainScoreSchema.index({ score: -1, createdAt: 1 });

export const WordChainScoreModel = mongoose.model<WordChainScoreDocument>('WordChainScore', wordChainScoreSchema);
