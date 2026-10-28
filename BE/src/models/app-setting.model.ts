// The settings of the whole app that admins change (SCRUM-210): one document, `key: 'global'`. Read and write it with
// app-setting.service.ts, which answers the defaults below while no admin has saved anything yet. A new setting is a new
// field here, with its default, not a new collection.
import mongoose, { Schema } from 'mongoose';

/** The `key` of the one settings document. */
export const APP_SETTINGS_KEY = 'global';

/** How many of the active daily tasks a learner gets each day: the default, and the most an admin may choose. */
export const DEFAULT_DAILY_TASK_COUNT = 3;
export const MAX_DAILY_TASK_COUNT = 10;

/** The settings themselves, without the bookkeeping fields of the document. */
export interface AppSettings {
  /** How many of the active daily tasks a learner gets each day (1 to `MAX_DAILY_TASK_COUNT`). */
  dailyTaskCount: number;
}

export interface AppSettingDocument extends mongoose.Document, AppSettings {
  key: string;
  createdAt: Date;
  updatedAt: Date;
}

const appSettingSchema = new Schema<AppSettingDocument>(
  {
    key: { type: String, required: true, default: APP_SETTINGS_KEY },
    dailyTaskCount: {
      type: Number,
      required: true,
      default: DEFAULT_DAILY_TASK_COUNT,
      min: 1,
      max: MAX_DAILY_TASK_COUNT,
      validate: { validator: Number.isInteger, message: 'Use a whole number' }
    }
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

// One document only: the first save is an upsert on `key`, and two admins saving at the same time still make one.
appSettingSchema.index({ key: 1 }, { unique: true });

export const AppSettingModel = mongoose.model<AppSettingDocument>('AppSetting', appSettingSchema);
