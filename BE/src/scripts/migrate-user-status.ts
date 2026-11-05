/**
 * Accounts saved before the `status` field existed have none, and the placement leaderboard only lists `active` accounts.
 * Gives `active` to the accounts with no status (locked accounts keep theirs). Safe to run many times. Run once after
 * deploying with `npm run migrate:user-status`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { UserModel } from '../models/user.model';

export const migrateUserStatus = async () => {
  // `status: null` matches a missing field and a null one.
  const { modifiedCount } = await UserModel.updateMany({ status: null }, { $set: { status: 'active' } });
  return { updated: modifiedCount };
};

const run = async () => {
  await connectDb();
  const { updated } = await migrateUserStatus();
  console.log(`Accounts set to active: ${updated}.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
