/**
 * Adds the starter themes (src/data/themes.ts) to the database, published for everyone. Safe to run many times:
 * themes already there are left untouched. Run with `npm run import:themes`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { THEME_LIST } from '../data/themes';
import { seedThemes } from '../services/theme-seed.service';

const run = async () => {
  await connectDb();
  const { added, skipped } = await seedThemes(THEME_LIST);
  console.log(`Added ${added} themes, ${skipped} already in the database.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
