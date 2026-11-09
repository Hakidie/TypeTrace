// A user's plan over time (US11.1): one row for each term of a plan. A Premium term has its own dates and starts when the
// last one ends (a row can start in the future). Rows are only added; the only edits are the two closing fields
// `endedAt` and `cancelledAt`. The plan now is the newest row in effect (subscription.service.ts); a Premium row that has
// passed its end reads as Free.
import mongoose, { Schema, Types } from 'mongoose';

export const PLAN_IDS = ['free', 'premium'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Who made the row: sign-up, a payment, an admin, the system when Premium ran out (`auto`), or the migration script. */
export const SUBSCRIPTION_SOURCES = ['signup', 'payment', 'admin', 'auto', 'migration'] as const;
export type SubscriptionSource = (typeof SUBSCRIPTION_SOURCES)[number];

/** Where a term is now (worked out when it is read, never stored): see `subscriptionStatus`. */
export const SUBSCRIPTION_STATUSES = ['upcoming', 'active', 'cancelled', 'ended'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionDocument extends mongoose.Document {
  user: Types.ObjectId;
  plan: PlanId;
  startsAt: Date;
  /** Premium rows only: when the paid term ends. */
  expiresAt?: Date;
  /** When the row really stopped, if that is not `expiresAt`: a Free row when Premium starts, a Premium row cut short by a revoke (a term that never started: its `startsAt`). */
  endedAt?: Date;
  /** When an admin cancelled it: the term keeps running to its end, a revoke also stops it at once. */
  cancelledAt?: Date;
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
    endedAt: { type: Date },
    cancelledAt: { type: Date },
    source: { type: String, enum: SUBSCRIPTION_SOURCES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The newest row in effect of a user is their plan.
subscriptionSchema.index({ user: 1, startsAt: -1, createdAt: -1, _id: -1 });
// The `auto` row of an expiry is written once, whoever reads the expired plan first or however many read it together.
subscriptionSchema.index({ user: 1, startsAt: 1 }, { unique: true, partialFilterExpression: { source: 'auto' } });

export const SubscriptionModel = mongoose.model<SubscriptionDocument>('Subscription', subscriptionSchema);
