// A daily task template (SCRUM-210): a goal for one of a learner's days, such as "finish 3 counted sessions". Admins
// manage them on /admin/daily-tasks; each day a learner is meant to get `dailyTaskCount` (AppSetting) of the active ones.
import mongoose, { Schema } from 'mongoose';

/**
 * What a task asks of a learner's day, measured on their counted sessions like the daily mission: `sessions` = finish
 * `target` of them, `minutes` = `target` minutes of them in all, `wpm` = one of them at `target` words per minute or
 * more, `accuracy` = one of them at `target` % accuracy or more.
 */
export const DAILY_TASK_TYPES = ['sessions', 'minutes', 'wpm', 'accuracy'] as const;
export type DailyTaskType = (typeof DAILY_TASK_TYPES)[number];

/**
 * The largest `target` of each type, so every task can be done in a day. A counted session has at most 200 WPM
 * (`MAX_COUNTED_WPM` in typing-session.service.ts) and accuracy is a percentage. The admin page has the same table.
 */
export const DAILY_TASK_TARGET_MAX: Record<DailyTaskType, number> = { sessions: 20, minutes: 120, wpm: 200, accuracy: 100 };

export interface DailyTaskDocument extends mongoose.Document {
  title: string;
  /** Optional words for the learner; '' when there are none. */
  description: string;
  type: DailyTaskType;
  /** A whole number from 1 to the `DAILY_TASK_TARGET_MAX` of the type. */
  target: number;
  /** Only active tasks are handed out; an inactive one is kept for later. */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dailyTaskSchema = new Schema<DailyTaskDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    type: { type: String, enum: DAILY_TASK_TYPES, required: true },
    target: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: 'Use a whole number' } },
    isActive: { type: Boolean, default: true }
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

// The target must fit the type the task has once saved. Checked by create() and save(), so an update that changes only
// the type, or only the target, is checked too (the service updates with save(), not findByIdAndUpdate).
dailyTaskSchema.pre('validate', function () {
  const max: number | undefined = DAILY_TASK_TARGET_MAX[this.type];
  if (max !== undefined && this.target > max) this.invalidate('target', `At most ${max} for type ${this.type}`, this.target);
});

// The admin list sorted by title uses the `vi` collation (Đ right after D), and a query with a collation can only use
// the indexes with the same one.
dailyTaskSchema.index({ title: 1 }, { collation: { locale: 'vi' } });

export const DailyTaskModel = mongoose.model<DailyTaskDocument>('DailyTask', dailyTaskSchema);
