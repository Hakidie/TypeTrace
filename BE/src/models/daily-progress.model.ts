// One learner's day (SCRUM-31): the counted typing sessions they finished that day, in their own time zone. Feeds the
// streak, the daily mission and the profile heatmap. Written by `recordCountedSession` (daily-progress.service.ts).
import mongoose, { Schema, Types } from 'mongoose';

export interface DailyProgressDocument extends mongoose.Document {
  owner: Types.ObjectId;
  /** The learner's calendar day, 'YYYY-MM-DD' in their `settings.timezone` when the sessions were counted. */
  date: string;
  /** Counted sessions finished that day (see `isSessionCounted`). */
  sessions: number;
  /** When `sessions` reached `DAILY_MISSION_SESSIONS`: the daily mission was done. Absent until then. */
  missionCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dailyProgressSchema = new Schema<DailyProgressDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    sessions: { type: Number, default: 0, min: 0 },
    missionCompletedAt: Date
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

// One row per learner and day: two sessions counted at the same time add to the same row (the upsert relies on it).
// It also serves "one learner's days in date order".
dailyProgressSchema.index({ owner: 1, date: 1 }, { unique: true });

export const DailyProgressModel = mongoose.model<DailyProgressDocument>('DailyProgress', dailyProgressSchema);
