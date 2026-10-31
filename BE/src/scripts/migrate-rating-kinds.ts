/**
 * Ratings saved before word rain duels had no `kind`: they are race ratings. Sets `kind: 'race'` on them and replaces the
 * old one-rating-per-season index by the one-per-kind index. Safe to run many times. Run once after deploying with
 * `npm run migrate:rating-kinds`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { SeasonRatingModel } from '../models/season-rating.model';

/** The index of the time before kinds: one rating per player and season. It would refuse a rain rating. */
const OLD_INDEX = 'season_1_user_1';

export const migrateRatingKinds = async () => {
  const { modifiedCount } = await SeasonRatingModel.updateMany({ kind: { $exists: false } }, { $set: { kind: 'race' } });
  const indexes = await SeasonRatingModel.collection.indexes();
  if (indexes.some((index) => index.name === OLD_INDEX)) await SeasonRatingModel.collection.dropIndex(OLD_INDEX);
  await SeasonRatingModel.syncIndexes();
  return { updated: modifiedCount };
};

const run = async () => {
  await connectDb();
  const { updated } = await migrateRatingKinds();
  console.log(`Ratings set to race: ${updated}.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
