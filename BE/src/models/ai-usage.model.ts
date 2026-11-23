// How many passages the AI wrote for a learner on a local day (SCRUM-153): one row per learner and day, counted by
// `reserveAiLesson` (services/targeted-practice.service.ts). Rows delete themselves a few days after the day.
import mongoose, { Schema } from 'mongoose';

export interface AiUsageDocument extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  /** The learner's local day, 'YYYY-MM-DD' (`localDateKey`). */
  day: string;
  count: number;
  createdAt: Date;
}

const aiUsageSchema = new Schema<AiUsageDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    count: { type: Number, required: true, default: 0, min: 0 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One row a learner and day: two requests at once still make one.
aiUsageSchema.index({ user: 1, day: 1 }, { unique: true });
// A day is over after one night in any zone; three days keep it safe.
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

export const AiUsageModel = mongoose.model<AiUsageDocument>('AiUsage', aiUsageSchema);
