// A user's plan over time (US11.1): one row each time their plan changes, never edited afterwards. The plan now is the
// newest row (subscription.service.ts); a Premium row that has passed its `expiresAt` reads as Free.
import mongoose, { Schema, Types } from 'mongoose';

export const PLAN_IDS = ['free', 'premium'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Who made the row: sign-up, a payment, an admin, the system when Premium ran out (`auto`), or the migration script. */
export const SUBSCRIPTION_SOURCES = ['signup', 'payment', 'admin', 'auto', 'migration'] as const;
export type SubscriptionSource = (typeof SUBSCRIPTION_SOURCES)[number];

export interface SubscriptionDocument extends mongoose.Document {
  user: Types.ObjectId;
  plan: PlanId;
  startsAt: Date;
  /** Premium rows only. */
  expiresAt?: Date;
  source: SubscriptionSource;
  /** The admin who changed the plan; `null` when the system did. */
  changedBy: Types.ObjectId | null;
  createdAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: PLAN_IDS, required: true },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date },
    source: { type: String, enum: SUBSCRIPTION_SOURCES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The newest row of a user is their plan.
subscriptionSchema.index({ user: 1, createdAt: -1, _id: -1 });
// The `auto` row of an expiry is written once, whoever reads the expired plan first or however many read it together.
subscriptionSchema.index({ user: 1, startsAt: 1 }, { unique: true, partialFilterExpression: { source: 'auto' } });

export const SubscriptionModel = mongoose.model<SubscriptionDocument>('Subscription', subscriptionSchema);
