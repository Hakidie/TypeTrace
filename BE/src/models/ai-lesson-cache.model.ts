// Passages the AI wrote for Weak spots, kept for other lessons (SCRUM-153): used when a learner is past their AI limit of
// the day. Shared by every learner, no user data inside. Rows delete themselves `weakSpotsAi.cacheDays` days after they are saved.
import mongoose, { Schema } from 'mongoose';
import { weakSpotsAi } from '../config/weak-spots-ai';

export interface AiLessonCacheDocument extends mongoose.Document {
  /** The language and the sorted error types of the lesson, e.g. `vi:HOI_NGA_CONFUSION+TONE_WRONG`. */
  key: string;
  /** The words of the passage, as typed. */
  words: string[];
  createdAt: Date;
}

const aiLessonCacheSchema = new Schema<AiLessonCacheDocument>(
  {
    key: { type: String, required: true },
    words: { type: [String], required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

aiLessonCacheSchema.index({ key: 1 });
aiLessonCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: weakSpotsAi.cacheDays * 24 * 60 * 60 });

export const AiLessonCacheModel = mongoose.model<AiLessonCacheDocument>('AiLessonCache', aiLessonCacheSchema);
