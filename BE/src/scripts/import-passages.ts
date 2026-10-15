/**
 * Adds the starter passages (src/data/passages.ts) to the passage bank, owned by TypeTrace. Safe to run many times:
 * passages already in the bank are left untouched. Run with `npm run import:passages`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { PASSAGE_LIST } from '../data/passages';
import { seedPassages } from '../services/passage-seed.service';

const run = async () => {
  await connectDb();
  const { added, skipped } = await seedPassages(PASSAGE_LIST);
  console.log(`Added ${added} passages, ${skipped} already in the bank.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
