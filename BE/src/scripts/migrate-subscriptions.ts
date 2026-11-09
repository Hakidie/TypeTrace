/**
 * Accounts saved before subscriptions existed have no row, and a missing row already reads as Free. Gives each of them
 * a Free `migration` row that starts the day the account was made, so every account has a history. Safe to run many
 * times. Run once after deploying with `npm run migrate:subscriptions`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { SubscriptionModel } from '../models/subscription.model';
import { UserModel } from '../models/user.model';

export const migrateSubscriptions = async () => {
  const withRows = await SubscriptionModel.distinct('user');
  const users = await UserModel.find({ _id: { $nin: withRows } }).select('_id createdAt').lean();
  if (users.length === 0) return { created: 0 };
  await SubscriptionModel.insertMany(
    users.map((user) => ({ user: user._id, plan: 'free', startsAt: user.createdAt, source: 'migration', changedBy: null }))
  );
  return { created: users.length };
};

const run = async () => {
  await connectDb();
  const { created } = await migrateSubscriptions();
  console.log(`Free subscription rows created: ${created}.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
