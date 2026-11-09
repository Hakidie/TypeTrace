// The settings of the whole app that admins change (SCRUM-210): one document, `key: 'global'`. Read and write it with
// app-setting.service.ts, which answers the defaults below while no admin has saved anything yet. A new setting is a new
// field here, with its default, not a new collection.
import mongoose, { Schema } from 'mongoose';
import type { PlanId } from './subscription.model';

/** The `key` of the one settings document. */
export const APP_SETTINGS_KEY = 'global';

/** How many of the active daily tasks a learner gets each day: the default, and the most an admin may choose. */
export const DEFAULT_DAILY_TASK_COUNT = 3;
export const MAX_DAILY_TASK_COUNT = 10;

/** The accuracy a placement session needs to go on the placement leaderboard (US10.1): the default, and the lowest and highest an admin may choose. */
export const DEFAULT_PLACEMENT_MIN_ACCURACY = 90;
export const MIN_PLACEMENT_MIN_ACCURACY = 50;
export const MAX_PLACEMENT_MIN_ACCURACY = 100;

/** What one plan gives (US11.1). Admins change it in the admin Plans page. */
export interface PlanConfig {
  /** Price of one month, in VND. */
  priceVnd: number;
  /** How many passages of their own a learner on this plan may have (`countCountedPassages`). */
  maxPassages: number;
  /** May create practice by error type (US3.2 checks this). */
  canCreateErrorPractice: boolean;
  /** May practice the approved public passages of other learners. */
  canUsePublicPassages: boolean;
}

/** The plans until an admin saves others. */
export const DEFAULT_PLANS: Record<PlanId, PlanConfig> = {
  free: { priceVnd: 0, maxPassages: 9, canCreateErrorPractice: false, canUsePublicPassages: false },
  premium: { priceVnd: 99000, maxPassages: 90, canCreateErrorPractice: true, canUsePublicPassages: true }
};

/** The settings themselves, without the bookkeeping fields of the document. */
export interface AppSettings {
  /** How many of the active daily tasks a learner gets each day (1 to `MAX_DAILY_TASK_COUNT`). */
  dailyTaskCount: number;
  /** The accuracy (in percent) a placement session needs to go on the placement leaderboard. */
  placementMinAccuracy: number;
  /** What the Free and Premium plans give. */
  plans: Record<PlanId, PlanConfig>;
}

export interface AppSettingDocument extends mongoose.Document, AppSettings {
  key: string;
  createdAt: Date;
  updatedAt: Date;
}

const wholeNumber = { validator: Number.isInteger, message: 'Use a whole number' };

const planConfigSchema = new Schema<PlanConfig>(
  {
    priceVnd: { type: Number, required: true, min: 0, validate: wholeNumber },
    maxPassages: { type: Number, required: true, min: 0, validate: wholeNumber },
    canCreateErrorPractice: { type: Boolean, required: true },
    canUsePublicPassages: { type: Boolean, required: true }
  },
  { _id: false }
);

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
    },
    placementMinAccuracy: {
      type: Number,
      required: true,
      default: DEFAULT_PLACEMENT_MIN_ACCURACY,
      min: MIN_PLACEMENT_MIN_ACCURACY,
      max: MAX_PLACEMENT_MIN_ACCURACY,
      validate: { validator: Number.isInteger, message: 'Use a whole number' }
    },
    plans: {
      free: { type: planConfigSchema, default: () => ({ ...DEFAULT_PLANS.free }) },
      premium: { type: planConfigSchema, default: () => ({ ...DEFAULT_PLANS.premium }) }
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
