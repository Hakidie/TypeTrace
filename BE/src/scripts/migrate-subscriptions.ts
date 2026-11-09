/**
 * Accounts saved before subscriptions existed have no row, and a missing row already reads as Free. Gives each of them
 * a Free `migration` row that starts the day the account was made, so every account has a history. Safe to run many
 * times. It also closes the rows of the first version of US11.1 (see `closeOldRows`). Run once after deploying with
 * `npm run migrate:subscriptions`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { SubscriptionModel } from '../models/subscription.model';
import { UserModel } from '../models/user.model';

/**
 * Rows written by the first version of US11.1 were never closed: a Free row did not say when Premium replaced it, and a grant or a
 * revoke started at once on top of the live term. Closes them like the terms are now: each row stops where the next one starts,
 * and a Premium cut short by a Free admin row reads as cancelled.
 */
const closeOldRows = async () => {
  const rows = await SubscriptionModel.find().sort({ user: 1, startsAt: 1, createdAt: 1, _id: 1 }).lean();
  let closed = 0;
  for (const [index, row] of rows.entries()) {
    const next = rows[index + 1];
    if (row.endedAt || !next || String(next.user) !== String(row.user)) continue;
    const cutShort = row.plan === 'free' || (row.expiresAt && next.startsAt.getTime() < row.expiresAt.getTime());
    if (!cutShort) continue;
    const cancelled = row.plan === 'premium' && next.plan === 'free' && next.source === 'admin';
    await SubscriptionModel.updateOne({ _id: row._id }, { endedAt: next.startsAt, ...(cancelled ? { cancelledAt: next.createdAt } : {}) });
    closed += 1;
  }
  return closed;
};

export const migrateSubscriptions = async () => {
  const withRows = await SubscriptionModel.distinct('user');
  const users = await UserModel.find({ _id: { $nin: withRows } }).select('_id createdAt').lean();
  if (users.length > 0) {
    await SubscriptionModel.insertMany(
      users.map((user) => ({ user: user._id, plan: 'free', startsAt: user.createdAt, source: 'migration', changedBy: null }))
    );
  }
  return { created: users.length, closed: await closeOldRows() };
};

const run = async () => {
  await connectDb();
  const { created, closed } = await migrateSubscriptions();
  console.log(`Free subscription rows created: ${created}. Rows closed: ${closed}.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
