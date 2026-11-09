// Who is on which plan (US11.1): the rows of `SubscriptionModel`. Expiry is worked out when a plan is read; there is no job.
import type { QueryFilter } from 'mongoose';
import { PlanId, SubscriptionDocument, SubscriptionModel, SubscriptionSource, SubscriptionStatus } from '../models/subscription.model';
import { badRequest } from '../utils/app-error';
import { addMonths } from '../utils/local-date';

export interface CurrentSubscription {
  plan: PlanId;
  expiresAt: Date | null;
}

type Term = Pick<SubscriptionDocument, 'startsAt' | 'expiresAt' | 'endedAt' | 'cancelledAt'>;

const FREE: CurrentSubscription = { plan: 'free', expiresAt: null };
const isDuplicateKey = (error: unknown) => (error as { code?: number }).code === 11000;

/** When a row stops: the day it was closed, else the end of its paid term; `null` for a Free row nobody closed. */
export const endOf = (row: Pick<Term, 'expiresAt' | 'endedAt'>): Date | null => row.endedAt ?? row.expiresAt ?? null;

/** Cancelled (also while it runs to its end), upcoming (not started), active (in effect) or ended. */
export const subscriptionStatus = (row: Term, now = new Date()): SubscriptionStatus => {
  if (row.cancelledAt) return 'cancelled';
  if (row.startsAt.getTime() > now.getTime()) return 'upcoming';
  const end = endOf(row);
  return !end || end.getTime() > now.getTime() ? 'active' : 'ended';
};

/** The same statuses as `subscriptionStatus`, as a MongoDB filter (for the admin list). */
export const statusFilter = (status: SubscriptionStatus, now = new Date()): QueryFilter<SubscriptionDocument> => {
  const notCancelled = { cancelledAt: null };
  const running = { cancelledAt: null, startsAt: { $lte: now } };
  const open = [{ endedAt: null, expiresAt: null }, { endedAt: null, expiresAt: { $gt: now } }, { endedAt: { $gt: now } }];
  if (status === 'cancelled') return { cancelledAt: { $ne: null } };
  if (status === 'upcoming') return { ...notCancelled, startsAt: { $gt: now } };
  if (status === 'active') return { ...running, $or: open };
  return { ...running, $nor: open };
};

/** The rows of a user that are in effect at `now`. */
const inEffect = <T extends Term>(rows: T[], now: Date) =>
  rows.filter((row) => {
    const end = endOf(row);
    return row.startsAt.getTime() <= now.getTime() && (!end || end.getTime() > now.getTime());
  });

/** The premium terms of a user that have not ended yet at `now` (running or waiting). */
const livePremiumTerms = (userId: string, now: Date) =>
  SubscriptionModel.find({ user: userId, plan: 'premium', $or: [{ endedAt: { $gt: now } }, { endedAt: null, expiresAt: { $gt: now } }] }).sort({ startsAt: 1, _id: 1 });

/**
 * The plan of a user now: their newest row in effect, or Free without any. Premium shows when its last term ends. A Premium
 * with nothing after it that has run out reads as Free, and the first read after it writes the `auto` Free row (starting at
 * the end; the unique index keeps it to one).
 */
export const getCurrentSubscription = async (userId: string, now = new Date()): Promise<CurrentSubscription> => {
  const started = await SubscriptionModel.find({ user: userId, startsAt: { $lte: now } }).sort({ startsAt: -1, createdAt: -1, _id: -1 }).lean();
  const [current] = inEffect(started, now);
  if (current) {
    if (current.plan === 'free') return FREE;
    const terms = await livePremiumTerms(userId, now);
    return { plan: 'premium', expiresAt: terms.reduce((last, term) => (endOf(term)! > last ? endOf(term)! : last), endOf(current)!) };
  }
  const latest = started[0];
  if (!latest || latest.plan === 'free') return FREE;

  try {
    await SubscriptionModel.create({ user: userId, plan: 'free', startsAt: endOf(latest) ?? now, source: 'auto', changedBy: null });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  return FREE;
};

/**
 * Adds `months` of Premium as a new term that starts when the last one ends (or now when there is none), so each term keeps
 * its own dates. A cancel waiting on the last term is taken back; the Free row that was open stops now.
 */
const addPremiumMonths = async (userId: string, months: number, source: SubscriptionSource, changedBy: string | null, now: Date) => {
  await getCurrentSubscription(userId, now);
  const terms = await livePremiumTerms(userId, now);
  const last = terms[terms.length - 1];
  const startsAt = last ? endOf(last)! : now;
  const expiresAt = addMonths(startsAt, months);
  if (last?.cancelledAt) await SubscriptionModel.updateOne({ _id: last._id }, { $unset: { cancelledAt: 1 } });
  if (!last) await SubscriptionModel.updateMany({ user: userId, plan: 'free', endedAt: null }, { endedAt: now });
  await SubscriptionModel.create({ user: userId, plan: 'premium', startsAt, expiresAt, source, changedBy });
  return { plan: 'premium' as const, expiresAt };
};

/** An admin gives `months` of Premium, after what the user already has. */
export const grantPremium = (userId: string, months: number, adminId: string, now = new Date()) =>
  addPremiumMonths(userId, months, 'admin', adminId, now);

/** An admin cancels Premium: the user keeps it until the last paid term ends, then is Free. 400 without Premium. */
export const cancelPremium = async (userId: string, now = new Date()) => {
  const terms = await livePremiumTerms(userId, now);
  const last = terms[terms.length - 1];
  if (!last) throw badRequest('This user has no Premium to cancel');
  if (!last.cancelledAt) await SubscriptionModel.updateOne({ _id: last._id }, { cancelledAt: now });
};

/** An admin takes Premium away at once: the running term stops now, the ones not started never start, the user is Free from now. */
export const revokePremium = async (userId: string, adminId: string, now = new Date()) => {
  for (const term of await livePremiumTerms(userId, now)) {
    const endedAt = term.startsAt.getTime() > now.getTime() ? term.startsAt : now;
    await SubscriptionModel.updateOne({ _id: term._id }, { endedAt, cancelledAt: term.cancelledAt ?? now });
  }
  await SubscriptionModel.updateMany({ user: userId, plan: 'free', endedAt: null }, { endedAt: now });
  await SubscriptionModel.create({ user: userId, plan: 'free', startsAt: now, source: 'admin', changedBy: adminId });
};

/** A paid month (US11.2, US11.3): the same as a grant, written as a payment. */
export const recordPaidMonth = (userId: string, months: number, now = new Date()) =>
  addPremiumMonths(userId, months, 'payment', null, now);

/** Everyone on a live Premium now, with the day it ends and whether it is cancelled (keyed by user id). Read only: it writes no `auto` row. */
export const getPremiumExpiries = async (now = new Date()) => {
  const rows = await SubscriptionModel.aggregate<{ _id: unknown; expiresAt: Date; cancelled: boolean }>([
    { $match: { plan: 'premium' } },
    { $addFields: { end: { $ifNull: ['$endedAt', '$expiresAt'] } } },
    { $match: { end: { $gt: now } } },
    { $sort: { startsAt: 1 } },
    { $group: { _id: '$user', firstStart: { $first: '$startsAt' }, expiresAt: { $max: '$end' }, cancelled: { $max: { $cond: [{ $ifNull: ['$cancelledAt', false] }, 1, 0] } } } },
    { $match: { firstStart: { $lte: now } } },
    { $project: { expiresAt: 1, cancelled: { $eq: ['$cancelled', 1] } } }
  ]);
  return new Map(rows.map((row) => [String(row._id), { expiresAt: row.expiresAt, cancelled: row.cancelled }]));
};
