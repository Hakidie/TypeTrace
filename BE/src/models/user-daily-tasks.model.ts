// A learner's daily tasks of one of their days (SCRUM-112): the DailyTask templates picked for them that day, copied once,
// and the numbers of that day's counted sessions the tasks are measured on. Written by user-daily-tasks.service.ts only.
import mongoose, { Schema, Types } from 'mongoose';
import { WordError, WordErrorType } from '../utils/vietnamese-errors';
import { DAILY_TASK_TYPES, DailyTaskType } from './daily-task.model';

/** One task of the day: its template as it was when the day's tasks were made. */
export interface UserDailyTask {
  /** The template it was copied from, which may have been edited or deleted since. */
  taskId: Types.ObjectId;
  title: string;
  /** '' when the template has none. */
  description: string;
  type: DailyTaskType;
  target: number;
  /** The error type of an accuracy task with a focus; absent otherwise. */
  errorType?: WordErrorType;
}

/** The numbers of the counted sessions of one learner's day, which every task of that day is measured on. */
export interface DayNumbers {
  /** How many counted sessions the day has. */
  sessions: number;
  /** Their time in all. */
  durationMs: number;
  /** The best WPM of one of them. */
  bestWpm: number;
  /** The best accuracy (%) of one of them. */
  bestAccuracy: number;
  /**
   * The best accuracy (%) on each error type of one of them, only from the sessions with at least `MIN_FOCUS_CHANCES`
   * chances of that type (user-daily-tasks.service.ts): a type without such a session has no key.
   */
  bestErrorAccuracy: Partial<Record<WordErrorType, number>>;
}

export interface UserDailyTasksDocument extends mongoose.Document {
  owner: Types.ObjectId;
  /** The learner's calendar day, 'YYYY-MM-DD' in their `settings.timezone`, like DailyProgress. */
  date: string;
  /**
   * The zone `progress` is cut in: the learner's zone when the day was made, or the one they moved to since, once a
   * request of theirs worked the numbers out again in it (user-daily-tasks.service.ts).
   */
  timeZone: string;
  /** The tasks picked for the day, in the order they are shown. Stored once and never changed. */
  tasks: UserDailyTask[];
  /**
   * Only grows during the day (`$max`) while the learner stays in `timeZone`, so a repeated or late write never takes it
   * back. Replaced when they move to another zone, where the old numbers can count sessions of another day.
   */
  progress: DayNumbers;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<UserDailyTask>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'DailyTask', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: DAILY_TASK_TYPES, required: true },
    target: { type: Number, required: true },
    errorType: { type: String, enum: Object.values(WordError) }
  },
  { _id: false }
);

const errorAccuracyDefinition = Object.fromEntries(Object.values(WordError).map((type) => [type, Number]));

const numbersSchema = new Schema<DayNumbers>(
  {
    sessions: { type: Number, default: 0, min: 0 },
    durationMs: { type: Number, default: 0, min: 0 },
    bestWpm: { type: Number, default: 0, min: 0 },
    bestAccuracy: { type: Number, default: 0, min: 0 },
    bestErrorAccuracy: { type: new Schema(errorAccuracyDefinition, { _id: false }), default: () => ({}) }
  },
  { _id: false }
);

const userDailyTasksSchema = new Schema<UserDailyTasksDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timeZone: { type: String, required: true },
    tasks: { type: [taskSchema], default: [] },
    progress: { type: numbersSchema, default: () => ({}) }
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

// One snapshot per learner and day: two requests that make it at the same time keep one (the upsert relies on it).
userDailyTasksSchema.index({ owner: 1, date: 1 }, { unique: true });
// The recent days that had some of the templates, for the chart of the admin list (`hourlyCompletionsOf`).
userDailyTasksSchema.index({ 'tasks.taskId': 1, date: 1 });

export const UserDailyTasksModel = mongoose.model<UserDailyTasksDocument>('UserDailyTasks', userDailyTasksSchema);
