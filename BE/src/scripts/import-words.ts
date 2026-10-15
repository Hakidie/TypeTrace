/**
 * Adds the starter word list (src/data/words.ts) to the word bank, with error tags. Safe to run many times:
 * words already in the bank are left untouched. Run with `npm run import:words`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { WORD_LIST, WORD_LIST_SOURCE } from '../data/words';
import { importWords } from '../services/word-import.service';

const run = async () => {
  await connectDb();
  const { added, skipped, invalid } = await importWords(WORD_LIST);
  console.log(`Source: ${WORD_LIST_SOURCE}`);
  console.log(`Added ${added} words, ${skipped} already in the bank, ${invalid} invalid.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
