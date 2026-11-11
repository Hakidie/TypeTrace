/**
 * Adds the English practice passages (src/data/passages-en-practice.ts, SCRUM-219: what Practice offers a learner who types
 * in English, never marked `isRanked`) to the passage bank, owned by TypeTrace. Safe to run many times: passages already in
 * the bank are left untouched. Run with `npm run import:passages:en-practice`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { ENGLISH_PRACTICE_PASSAGE_LIST } from '../data/passages-en-practice';
import { seedPassages } from '../services/passage-seed.service';

const run = async () => {
  await connectDb();
  const { added, skipped } = await seedPassages(ENGLISH_PRACTICE_PASSAGE_LIST);
  console.log(`Added ${added} passages, ${skipped} already in the bank.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
