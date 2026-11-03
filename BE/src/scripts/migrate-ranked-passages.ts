/**
 * Ranked duels play only the passages marked `isRanked` (US6.4). Marks the published public English passages already in the
 * bank, so the duels keep their passages. Safe to run many times. Run once after deploying with
 * `npm run migrate:ranked-passages`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { PassageModel } from '../models/passage.model';

export const migrateRankedPassages = async () => {
  const { modifiedCount } = await PassageModel.updateMany(
    { language: 'en', status: 'published', visibility: 'public', isRanked: { $ne: true } },
    { $set: { isRanked: true } }
  );
  return { updated: modifiedCount };
};

const run = async () => {
  await connectDb();
  const { updated } = await migrateRankedPassages();
  console.log(`Passages marked as ranked: ${updated}.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
