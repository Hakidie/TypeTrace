// Who is on which plan (US11.1): the rows of `SubscriptionModel`. Expiry is worked out when a plan is read; there is no job.
import { PlanId, SubscriptionModel, SubscriptionSource } from '../models/subscription.model';
import { addMonths } from '../utils/local-date';

export interface CurrentSubscription {
  plan: PlanId;
  expiresAt: Date | null;
}

const FREE: CurrentSubscription = { plan: 'free', expiresAt: null };
const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/**
 * The plan of a user now: their newest row, or Free without any. A Premium row past its `expiresAt` reads as Free, and the
 * first read after it writes the `auto` Free row (starting at the expiry; the unique index keeps it to one).
 */
export const getCurrentSubscription = async (userId: string, now = new Date()): Promise<CurrentSubscription> => {
  const latest = await SubscriptionModel.findOne({ user: userId }).sort({ createdAt: -1, _id: -1 }).lean();
  if (!latest || latest.plan === 'free') return FREE;
  const expiresAt = latest.expiresAt;
  if (expiresAt && expiresAt.getTime() > now.getTime()) return { plan: 'premium', expiresAt };

  try {
    await SubscriptionModel.create({ user: userId, plan: 'free', startsAt: expiresAt ?? now, source: 'auto', changedBy: null });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  return FREE;
};

/** Adds `months` of Premium on top of what the user has left (or from `now` when it has run out), as a new row. */
const addPremiumMonths = async (userId: string, months: number, source: SubscriptionSource, changedBy: string | null, now: Date) => {
  const current = await getCurrentSubscription(userId, now);
  const from = current.plan === 'premium' && current.expiresAt ? current.expiresAt : now;
  const expiresAt = addMonths(from, months);
  await SubscriptionModel.create({ user: userId, plan: 'premium', startsAt: now, expiresAt, source, changedBy });
  return { plan: 'premium' as const, expiresAt };
};

/** An admin gives `months` of Premium. */
export const grantPremium = (userId: string, months: number, adminId: string, now = new Date()) =>
  addPremiumMonths(userId, months, 'admin', adminId, now);

/** An admin takes Premium away: the user is Free again from now. */
export const revokePremium = async (userId: string, adminId: string, now = new Date()) => {
  await SubscriptionModel.create({ user: userId, plan: 'free', startsAt: now, source: 'admin', changedBy: adminId });
};

/** A paid month (US11.2, US11.3): the same as a grant, written as a payment. */
export const recordPaidMonth = (userId: string, months: number, now = new Date()) =>
  addPremiumMonths(userId, months, 'payment', null, now);

/** Everyone on a live Premium now, with the day it ends (keyed by user id). Read only: it writes no `auto` row. */
export const getPremiumExpiries = async (now = new Date()) => {
  const rows = await SubscriptionModel.aggregate<{ _id: unknown; expiresAt: Date }>([
    { $sort: { user: 1, createdAt: -1, _id: -1 } },
    { $group: { _id: '$user', plan: { $first: '$plan' }, expiresAt: { $first: '$expiresAt' } } },
    { $match: { plan: 'premium', expiresAt: { $gt: now } } }
  ]);
  return new Map(rows.map((row) => [String(row._id), row.expiresAt]));
};
