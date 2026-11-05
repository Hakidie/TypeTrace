/**
 * Sets `isOnPlacementBoard` again, from the rules and the minimum accuracy saved, on every completed placement session. Fixes the
 * flags saved wrong (for example before the minimum accuracy became a setting an admin can change). Safe to run many times. Run it
 * after deploying that setting with `npm run migrate:placement-board`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { rebuildPlacementBoardFlags } from '../services/typing-session.service';

const run = async () => {
  await connectDb();
  const updated = await rebuildPlacementBoardFlags();
  console.log(`Sessions whose placement flag changed: ${updated}.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
